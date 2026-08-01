import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { z } from "zod";

import {
	createDocumentAiTargetRef,
	createUnusedDocumentAiRef,
	DocumentAiHtmlError,
	parseDocumentAiHtml,
	parseDocumentAiTargetRef,
	readTiptapNodeAiRef,
	withTiptapNodeAiRef,
} from "#/features/workspaces/documents/document-ai-html";
import {
	coerceTiptapDocumentJson,
	type TiptapDocumentJson,
} from "#/features/workspaces/documents/tiptap-document";
import { getTiptapDocumentSchema } from "#/features/workspaces/documents/tiptap-schema";

const documentAiRefSchema = z
	.string()
	.trim()
	.min(1)
	.max(64)
	.describe('Exact data-ref from a recent HTML read. Put it in the "ref" field, never "target".');
export const documentAiHtmlSchema = z
	.string()
	.max(512_000)
	.describe("Schema-constrained HTML fragment. Model-supplied data-ref attributes are ignored.");

export const documentAiEditSchema = z.union([
	z.strictObject({
		html: documentAiHtmlSchema,
		op: z.literal("replace"),
		ref: documentAiRefSchema,
	}),
	z.strictObject({
		html: documentAiHtmlSchema,
		op: z.literal("insert_before"),
		ref: documentAiRefSchema,
	}),
	z.strictObject({
		html: documentAiHtmlSchema,
		op: z.literal("insert_after"),
		ref: documentAiRefSchema,
	}),
	z.strictObject({
		op: z.literal("delete"),
		ref: documentAiRefSchema,
	}),
	z.strictObject({
		html: documentAiHtmlSchema,
		op: z.literal("replace_all"),
	}),
]);

export const documentAiEditFailureCodes = [
	"invalid_html",
	"no_change",
	"ref_not_found",
	"stale_target",
] as const;

export type DocumentAiEdit = z.infer<typeof documentAiEditSchema>;
export type DocumentAiEditFailureCode = (typeof documentAiEditFailureCodes)[number];
export type DocumentAiEditResultStatus = "applied" | "failed" | "partial" | "rejected";

export interface DocumentAiEditResult {
	applied: number;
	document: TiptapDocumentJson;
	failed: number;
	failures: { code: DocumentAiEditFailureCode; index: number }[];
	status: Exclude<DocumentAiEditResultStatus, "rejected">;
}

export async function applyDocumentAiEdits(
	document: TiptapDocumentJson,
	edits: DocumentAiEdit[],
): Promise<DocumentAiEditResult> {
	let current = getTiptapDocumentSchema().nodeFromJSON(document);
	// Validate every targeted edit against the document as it existed when this
	// tool call began. That lets one ordered batch reuse a read ref while still
	// rejecting the same ref in a later call after a human or agent changed it.
	const requestedStableRefs = new Set(
		edits.flatMap((edit) => {
			if (edit.op === "replace_all") {
				return [];
			}
			const stableRef = parseDocumentAiTargetRef(edit.ref);
			return stableRef ? [stableRef] : [];
		}),
	);
	const requestedTargets: Array<readonly [string, ProseMirrorNode]> = [];
	current.forEach((node) => {
		const stableRef = readTiptapNodeAiRef(node);
		if (stableRef && requestedStableRefs.has(stableRef)) {
			requestedTargets.push([stableRef, node]);
		}
	});
	const targetRefByStableRef = new Map(
		await Promise.all(
			requestedTargets.map(
				async ([stableRef, node]) => [stableRef, await createDocumentAiTargetRef(node)] as const,
			),
		),
	);
	const failures: DocumentAiEditResult["failures"] = [];
	let applied = 0;

	for (const [index, edit] of edits.entries()) {
		let stableRef: string | undefined;
		if (edit.op !== "replace_all") {
			const parsedRef = parseDocumentAiTargetRef(edit.ref);
			if (!parsedRef || !targetRefByStableRef.has(parsedRef)) {
				failures.push({ code: "ref_not_found", index });
				continue;
			}
			if (targetRefByStableRef.get(parsedRef) !== edit.ref) {
				failures.push({ code: "stale_target", index });
				continue;
			}
			stableRef = parsedRef;
		}

		const result = applyDocumentAiEdit(current, edit, stableRef);
		if (result.status === "failed") {
			failures.push({ code: result.code, index });
			continue;
		}

		current = result.document;
		applied++;
	}

	return {
		applied,
		document: coerceTiptapDocumentJson(current.toJSON()),
		failed: failures.length,
		failures,
		status: applied === 0 ? "failed" : failures.length > 0 ? "partial" : "applied",
	};
}

function applyDocumentAiEdit(
	document: ProseMirrorNode,
	edit: DocumentAiEdit,
	stableRef?: string,
):
	| { code: DocumentAiEditFailureCode; status: "failed" }
	| { document: ProseMirrorNode; status: "applied" } {
	if (edit.op === "replace_all") {
		const parsed = parseEditHtml(edit.html);
		if (!parsed) {
			return { code: "invalid_html", status: "failed" };
		}

		const next = createDocument(parsed);
		return documentsHaveSameVisibleContent(document, next)
			? { code: "no_change", status: "failed" }
			: { document: next, status: "applied" };
	}

	if (!stableRef) {
		throw new Error("Targeted document edits require a validated stable ref.");
	}
	const targetIndex = findTargetIndex(document, stableRef);
	if (targetIndex === -1) {
		return { code: "ref_not_found", status: "failed" };
	}

	const children = getDocumentChildren(document);
	if (edit.op === "delete") {
		children.splice(targetIndex, 1);
	} else {
		const parsed = parseEditHtml(edit.html);
		if (!parsed) {
			return { code: "invalid_html", status: "failed" };
		}
		const targetRef = readTiptapNodeAiRef(document.child(targetIndex));
		const inserted = assignDocumentAiRefs(parsed, edit.op === "replace" ? targetRef : null);

		switch (edit.op) {
			case "insert_after":
				children.splice(targetIndex + 1, 0, ...inserted);
				break;
			case "insert_before":
				children.splice(targetIndex, 0, ...inserted);
				break;
			case "replace":
				children.splice(targetIndex, 1, ...inserted);
				break;
		}
	}

	const next = createDocument(children);
	return documentsHaveSameVisibleContent(document, next)
		? { code: "no_change", status: "failed" }
		: { document: next, status: "applied" };
}

function parseEditHtml(html: string) {
	try {
		return getDocumentChildren(getTiptapDocumentSchema().nodeFromJSON(parseDocumentAiHtml(html)));
	} catch (error) {
		if (error instanceof DocumentAiHtmlError) {
			return null;
		}
		throw error;
	}
}

function createDocument(children: ProseMirrorNode[]) {
	const schema = getTiptapDocumentSchema();
	const editorChildren = children.length > 0 ? [...children] : [schema.nodes.paragraph.create()];

	// StarterKit keeps a paragraph after a final non-paragraph block so users can
	// place the cursor after lists, tables, and other atom-like content. Apply the
	// same invariant before persisting an AI edit so opening the editor is not
	// misclassified as a later human change.
	if (editorChildren.at(-1)?.type !== schema.nodes.paragraph) {
		editorChildren.push(schema.nodes.paragraph.create());
	}

	const content = assignDocumentAiRefs(editorChildren);
	const document = schema.topNodeType.create(null, Fragment.fromArray(content));
	document.check();
	return document;
}

function assignDocumentAiRefs(children: ProseMirrorNode[], firstRef: string | null = null) {
	const usedRefs = new Set<string>();
	return children.map((node, index) => {
		const existingRef = readTiptapNodeAiRef(node);
		const candidate = (index === 0 ? firstRef : null) || existingRef;
		const ref =
			candidate && !usedRefs.has(candidate) ? candidate : createUnusedDocumentAiRef(usedRefs);
		usedRefs.add(ref);
		return withTiptapNodeAiRef(node, ref);
	});
}

function documentsHaveSameVisibleContent(left: ProseMirrorNode, right: ProseMirrorNode) {
	return withoutTopLevelAiRefs(left).eq(withoutTopLevelAiRefs(right));
}

function withoutTopLevelAiRefs(document: ProseMirrorNode) {
	return document.type.create(
		document.attrs,
		Fragment.fromArray(
			getDocumentChildren(document).map((node) => withTiptapNodeAiRef(node, null)),
		),
	);
}

function findTargetIndex(document: ProseMirrorNode, ref: string) {
	for (let index = 0; index < document.childCount; index++) {
		if (readTiptapNodeAiRef(document.child(index)) === ref) {
			return index;
		}
	}
	return -1;
}

function getDocumentChildren(document: ProseMirrorNode) {
	return Array.from({ length: document.childCount }, (_, index) => document.child(index));
}
