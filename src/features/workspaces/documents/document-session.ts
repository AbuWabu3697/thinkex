import {
	prosemirrorJSONToYDoc,
	prosemirrorJSONToYXmlFragment,
	yXmlFragmentToProseMirrorRootNode,
} from "@tiptap/y-tiptap";
import type { Connection, ConnectionContext } from "partyserver";
import * as Y from "yjs";
import { YServer } from "y-partyserver";
import type { DocumentSessionRouteParams } from "#/features/workspaces/agent-routes";
import {
	applyDocumentAiEdits,
	type DocumentAiEdit,
	type DocumentAiEditFailureCode,
	type DocumentAiEditResultStatus,
} from "#/features/workspaces/documents/document-ai-edits";
import { ensureProseMirrorDocumentAiRefs } from "#/features/workspaces/documents/document-ai-html";
import {
	type DocumentHtmlChunkReadInput,
	type DocumentHtmlChunkReadResult,
	readDocumentHtmlChunk,
} from "#/features/workspaces/documents/document-html-chunk";
import {
	type DocumentSessionConnectionState,
	readForwardedDocumentSessionConnectionAccess,
} from "#/features/workspaces/documents/document-session-connection-access";
import type {
	DocumentEditReceiptReviewRpcResult,
	DocumentEditReceiptStatusResult,
	DocumentEditReceiptUndoResult,
} from "#/features/workspaces/documents/document-edit-receipt";
import {
	coerceTiptapDocumentJson,
	parseTiptapDocumentJson,
	stringifyTiptapDocumentJson,
	type TiptapDocumentJson,
} from "#/features/workspaces/documents/tiptap-document";
import {
	getTiptapDocumentSchema,
	tiptapDocumentYjsField,
} from "#/features/workspaces/documents/tiptap-schema";
import {
	readPersistedDocumentYjsUpdate,
	writePersistedDocumentYjsUpdate,
} from "#/features/workspaces/documents/document-yjs-persistence";
import {
	getWorkspaceKernelFromEnv,
	type WorkspaceKernelClient,
} from "#/features/workspaces/kernel/workspace-kernel-access";
import { sha256Base64Url, sha256Base64UrlText } from "#/lib/binary";

const latestDocumentEditReceiptKey = "document-session:ai-edit-receipt:latest";
const documentEditReceiptKeyPrefix = "document-session:ai-edit-receipt:";
const maximumDocumentEditReceiptSnapshotBytes = 1_500_000;
const checkpointDelayMs = 1_500;
const checkpointMaxWaitMs = 8_000;

export interface DocumentSessionApplyEditsInput {
	edits: DocumentAiEdit[];
	operationId: string;
}

export interface DocumentSessionApplyEditsResult {
	applied: number;
	failed: number;
	failures: {
		code: DocumentAiEditFailureCode | "content_changed" | "operation_id_conflict";
		index: number;
	}[];
	status: DocumentAiEditResultStatus;
}

interface StoredDocumentEditReceipt {
	afterHash: string;
	beforeDocument?: TiptapDocumentJson;
	id: string;
	inputHash: string;
	previousReceiptId: string | null;
	result: DocumentSessionApplyEditsResult;
	status: "applied" | "reverted";
}

type ResolvedDocumentEditReceiptGroup =
	| {
			beforeDocument: TiptapDocumentJson;
			lastReceiptId: string;
			previousReceiptId: string | null;
			receipts: StoredDocumentEditReceipt[];
			status: "ready";
	  }
	| {
			status: Exclude<DocumentEditReceiptStatusResult["status"], "ready">;
	  };

export class DocumentSession extends YServer {
	static override options = {
		hibernate: true,
	};

	private deleted = false;

	static override callbackOptions = {
		debounceWait: checkpointDelayMs,
		debounceMaxWait: checkpointMaxWaitMs,
	};

	override async onConnect(
		connection: Connection<DocumentSessionConnectionState>,
		context: ConnectionContext,
	) {
		if (this.deleted) {
			connection.close(1008, "Document deleted");
			return;
		}

		const access = readForwardedDocumentSessionConnectionAccess(context.request);

		if (!access) {
			connection.close(1011, "Unauthorized");
			return;
		}

		connection.setState({
			canMutate: access.canMutate,
			userId: access.userId,
		});
		void super.onConnect(connection, context);
	}

	override isReadOnly(connection: Connection<DocumentSessionConnectionState>) {
		return this.deleted || connection.state?.canMutate !== true;
	}

	override async onLoad() {
		const persistedUpdate = await readPersistedDocumentYjsUpdate(this.ctx.storage);
		if (this.deleted) {
			return;
		}

		if (persistedUpdate) {
			Y.applyUpdate(this.document, persistedUpdate, this);
			return;
		}

		const room = getDocumentSessionRoomNameParts(this.name);
		const kernel = await this.getWorkspaceKernel(room.workspaceId);
		const { content } = await kernel.readDocumentCheckpoint({ itemId: room.itemId });
		if (this.deleted) {
			return;
		}
		const snapshot = parseTiptapDocumentJson(content);
		const seededDoc = prosemirrorJSONToYDoc(
			getTiptapDocumentSchema(),
			snapshot,
			tiptapDocumentYjsField,
		);

		Y.applyUpdate(this.document, Y.encodeStateAsUpdate(seededDoc), this);
		seededDoc.destroy();
		await this.persistYDoc();
	}

	override async onSave() {
		if (this.deleted) {
			return;
		}

		await this.persistYDoc();
		if (this.deleted) {
			return;
		}
		await this.checkpointToKernel();
	}

	async applyEdits(
		input: DocumentSessionApplyEditsInput,
	): Promise<DocumentSessionApplyEditsResult> {
		this.assertActive();
		const inputHash = await sha256Base64UrlText(JSON.stringify(input.edits));
		const existingReceipt = await this.getDocumentEditReceipt(input.operationId);

		if (existingReceipt) {
			return existingReceipt.inputHash === inputHash
				? existingReceipt.result
				: operationIdConflictResult(input.edits.length);
		}

		const latestReceiptId = await this.ctx.storage.get<string>(latestDocumentEditReceiptKey);
		const latestReceipt = latestReceiptId
			? await this.getDocumentEditReceipt(latestReceiptId)
			: undefined;
		const referencedDocument = await this.getReferencedDocumentSnapshot();
		const currentDocument = coerceTiptapDocumentJson(referencedDocument.document.toJSON());
		const editResult = await applyDocumentAiEdits(currentDocument, input.edits);

		if (editResult.applied === 0) {
			return {
				applied: editResult.applied,
				failed: editResult.failed,
				failures: editResult.failures,
				status: editResult.status,
			};
		}

		const beforeDocumentText = stringifyTiptapDocumentJson(currentDocument);
		const afterDocumentText = stringifyTiptapDocumentJson(editResult.document);
		const [beforeHash, afterHash] = await Promise.all([
			sha256Base64UrlText(beforeDocumentText),
			sha256Base64UrlText(afterDocumentText),
		]);

		if (stringifyTiptapDocumentJson(this.getCurrentTiptapDocument()) !== beforeDocumentText) {
			return {
				applied: 0,
				failed: input.edits.length,
				failures: input.edits.map((_, index) => ({
					code: "content_changed",
					index,
				})),
				status: "rejected",
			};
		}

		const result: DocumentSessionApplyEditsResult = {
			applied: editResult.applied,
			failed: editResult.failed,
			failures: editResult.failures,
			status: editResult.status,
		};
		const receipt: StoredDocumentEditReceipt = {
			afterHash,
			...(fitsDocumentEditReceiptSnapshot(beforeDocumentText)
				? { beforeDocument: currentDocument }
				: {}),
			id: input.operationId,
			inputHash,
			previousReceiptId:
				latestReceipt?.status === "applied" && latestReceipt.afterHash === beforeHash
					? latestReceipt.id
					: null,
			result,
			status: "applied",
		};

		this.reconcileCurrentDocument(editResult.document);
		const persistedUpdate = Y.encodeStateAsUpdate(this.document);
		await this.ctx.storage.transaction(async (transaction) => {
			await writePersistedDocumentYjsUpdate(transaction, persistedUpdate);
			await Promise.all([
				transaction.put(getDocumentEditReceiptKey(receipt.id), receipt),
				transaction.put(latestDocumentEditReceiptKey, receipt.id),
			]);
		});
		this.assertActive();
		await this.checkpointToKernel(input.operationId);
		this.assertActive();

		return result;
	}

	async getDocumentEditReceiptStatus(input: {
		receiptIds: string[];
	}): Promise<DocumentEditReceiptStatusResult> {
		const group = await this.resolveDocumentEditReceiptGroup(input.receiptIds);
		return { status: group.status };
	}

	async getDocumentEditReceiptReview(input: {
		receiptIds: string[];
	}): Promise<DocumentEditReceiptReviewRpcResult> {
		const group = await this.resolveDocumentEditReceiptGroup(input.receiptIds);

		if (group.status !== "ready") {
			return { status: group.status };
		}

		return {
			afterContent: stringifyTiptapDocumentJson(this.getCurrentTiptapDocument()),
			beforeContent: stringifyTiptapDocumentJson(group.beforeDocument),
			status: "ready",
		};
	}

	async undoDocumentEditReceipt(input: {
		receiptIds: string[];
	}): Promise<DocumentEditReceiptUndoResult> {
		const group = await this.resolveDocumentEditReceiptGroup(input.receiptIds);

		if (group.status !== "ready") {
			return { status: group.status };
		}

		this.reconcileCurrentDocument(group.beforeDocument);
		const persistedUpdate = Y.encodeStateAsUpdate(this.document);

		await this.ctx.storage.transaction(async (transaction) => {
			await writePersistedDocumentYjsUpdate(transaction, persistedUpdate);
			await Promise.all(
				group.receipts.map((receipt) =>
					transaction.put(getDocumentEditReceiptKey(receipt.id), {
						...receipt,
						status: "reverted",
					} satisfies StoredDocumentEditReceipt),
				),
			);

			if (group.previousReceiptId) {
				await transaction.put(latestDocumentEditReceiptKey, group.previousReceiptId);
			} else {
				await transaction.delete(latestDocumentEditReceiptKey);
			}
		});

		await this.checkpointToKernel(`undo:${group.lastReceiptId}`);

		return { status: "reverted" };
	}

	async readHtmlChunk(input: DocumentHtmlChunkReadInput): Promise<DocumentHtmlChunkReadResult> {
		this.assertActive();
		const { document, stateVector } = await this.getReferencedDocumentSnapshot();
		const revision = await sha256Base64Url(stateVector);
		if (input.expectedRevision && input.expectedRevision !== revision) {
			return { status: "content_changed" };
		}

		const chunk = await readDocumentHtmlChunk(document, input.offset);
		return chunk ? { ...chunk, revision, status: "ready" } : { status: "invalid_offset" };
	}

	async purgeForDeletion(): Promise<void> {
		// Deliberately does not hydrate the document: this only wipes durable
		// storage, and onLoad could otherwise reseed from the deleted item.
		this.deleted = true;
		for (const connection of this.getConnections()) {
			connection.close(1008, "Document deleted");
		}
		this.document.destroy();
		await this.ctx.storage.deleteAll();
	}

	private async checkpointToKernel(clientMutationId: string | null = null) {
		const room = getDocumentSessionRoomNameParts(this.name);
		const document = this.getCurrentTiptapDocument();
		const kernel = await this.getWorkspaceKernel(room.workspaceId);

		await kernel.commitDocumentCheckpoint({
			itemId: room.itemId,
			content: stringifyTiptapDocumentJson(document),
			actorUserId: null,
			clientMutationId,
		});
	}

	private async getDocumentEditReceipt(receiptId: string) {
		return await this.ctx.storage.get<StoredDocumentEditReceipt>(
			getDocumentEditReceiptKey(receiptId),
		);
	}

	private async resolveDocumentEditReceiptGroup(
		receiptIds: string[],
	): Promise<ResolvedDocumentEditReceiptGroup> {
		if (receiptIds.length === 0 || new Set(receiptIds).size !== receiptIds.length) {
			return { status: "not_found" };
		}

		const receipts = await Promise.all(
			receiptIds.map((receiptId) => this.getDocumentEditReceipt(receiptId)),
		);
		const storedReceipts = receipts.filter(
			(receipt): receipt is StoredDocumentEditReceipt => receipt !== undefined,
		);
		if (storedReceipts.length !== receiptIds.length) {
			return { status: "not_found" };
		}
		if (storedReceipts.some((receipt) => receipt.status === "reverted")) {
			return { status: "reverted" };
		}
		for (let index = 1; index < storedReceipts.length; index += 1) {
			if (storedReceipts[index]?.previousReceiptId !== storedReceipts[index - 1]?.id) {
				return { status: "not_latest" };
			}
		}

		const firstReceipt = storedReceipts[0];
		const lastReceipt = storedReceipts.at(-1);
		if (!firstReceipt || !lastReceipt) {
			return { status: "not_found" };
		}

		const latestReceiptId = await this.ctx.storage.get<string>(latestDocumentEditReceiptKey);
		if (latestReceiptId !== lastReceipt.id) {
			return { status: "not_latest" };
		}
		if (!firstReceipt.beforeDocument) {
			return { status: "review_unavailable" };
		}

		this.assertActive();
		const currentDocumentText = stringifyTiptapDocumentJson(this.getCurrentTiptapDocument());
		const currentHash = await sha256Base64UrlText(currentDocumentText);

		return currentHash === lastReceipt.afterHash &&
			stringifyTiptapDocumentJson(this.getCurrentTiptapDocument()) === currentDocumentText
			? {
					beforeDocument: firstReceipt.beforeDocument,
					lastReceiptId: lastReceipt.id,
					previousReceiptId: firstReceipt.previousReceiptId,
					receipts: storedReceipts,
					status: "ready",
				}
			: { status: "content_changed" };
	}

	private getCurrentTiptapDocument() {
		return coerceTiptapDocumentJson(this.getCurrentProseMirrorDocument().toJSON());
	}

	private getCurrentProseMirrorDocument() {
		return yXmlFragmentToProseMirrorRootNode(
			this.document.getXmlFragment(tiptapDocumentYjsField),
			getTiptapDocumentSchema(),
		);
	}

	private reconcileCurrentDocument(document: TiptapDocumentJson) {
		const fragment = this.document.getXmlFragment(tiptapDocumentYjsField);
		prosemirrorJSONToYXmlFragment(getTiptapDocumentSchema(), document, fragment);
	}

	private async persistYDoc() {
		if (this.deleted) {
			return;
		}

		const update = Y.encodeStateAsUpdate(this.document);
		await this.ctx.storage.transaction((transaction) =>
			writePersistedDocumentYjsUpdate(transaction, update),
		);
	}

	private async getReferencedDocumentSnapshot() {
		const refs = ensureProseMirrorDocumentAiRefs(this.getCurrentProseMirrorDocument());
		if (refs.changed) {
			this.reconcileCurrentDocument(coerceTiptapDocumentJson(refs.document.toJSON()));
			await this.persistYDoc();
			return this.getDocumentSnapshot();
		}
		return {
			document: refs.document,
			stateVector: Uint8Array.from(Y.encodeStateVector(this.document)),
		};
	}

	private getDocumentSnapshot() {
		return {
			document: this.getCurrentProseMirrorDocument(),
			stateVector: Uint8Array.from(Y.encodeStateVector(this.document)),
		};
	}

	private assertActive() {
		if (this.deleted) {
			throw new Error("Document session has been deleted.");
		}
	}

	private async getWorkspaceKernel(workspaceId: string): Promise<WorkspaceKernelClient> {
		return getWorkspaceKernelFromEnv(this.env, workspaceId);
	}
}

function getDocumentSessionRoomNameParts(roomName: string): DocumentSessionRouteParams {
	const separatorIndex = roomName.indexOf(":");

	if (separatorIndex <= 0 || separatorIndex === roomName.length - 1) {
		throw new Error("Document session room name is invalid.");
	}

	return {
		workspaceId: roomName.slice(0, separatorIndex),
		itemId: roomName.slice(separatorIndex + 1),
	};
}

function getDocumentEditReceiptKey(receiptId: string) {
	return `${documentEditReceiptKeyPrefix}${receiptId}`;
}

function fitsDocumentEditReceiptSnapshot(documentText: string) {
	return (
		documentText.length <= maximumDocumentEditReceiptSnapshotBytes &&
		new TextEncoder().encode(documentText).byteLength <= maximumDocumentEditReceiptSnapshotBytes
	);
}

function operationIdConflictResult(editCount: number): DocumentSessionApplyEditsResult {
	return {
		applied: 0,
		failed: editCount,
		failures: Array.from({ length: editCount }, (_, index) => ({
			code: "operation_id_conflict",
			index,
		})),
		status: "rejected",
	};
}
