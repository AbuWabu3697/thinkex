import { getDocumentSessionFromEnv } from "#/features/workspaces/document-session-access";
import {
	getWorkspaceCapabilityPageContext,
	resolveWorkspaceCapabilityExistingItemPath,
} from "#/features/workspaces/capabilities/common";
import type { WorkspaceCapabilityContext } from "#/features/workspaces/capabilities/workspace-capability-context";
import type { DocumentSessionApplyMarkdownEditsResult } from "#/features/workspaces/documents/document-session";
import type { DocumentMarkdownEdit } from "#/features/workspaces/documents/document-markdown-edits";

type EditWorkspaceCapabilityFailureCode =
	| "cannot_edit_root"
	| "path_not_absolute"
	| "path_not_found"
	| "unsupported_item_type";

export interface EditWorkspaceCapabilityItemInput {
	edits: DocumentMarkdownEdit[];
	path: string;
}

type EditWorkspaceCapabilityFailure = DocumentSessionApplyMarkdownEditsResult["failures"][number];

export interface EditWorkspaceCapabilityItemResult {
	applied: number;
	failed: EditWorkspaceCapabilityFailure[];
	path: string;
	warnings: string[];
}

export async function editWorkspaceCapabilityItem(
	capabilityContext: WorkspaceCapabilityContext,
	input: EditWorkspaceCapabilityItemInput,
): Promise<EditWorkspaceCapabilityItemResult> {
	const workspaceContext = await getWorkspaceCapabilityPageContext({
		access: "mutate",
		context: capabilityContext,
	});
	const resolution = resolveWorkspaceCapabilityExistingItemPath({
		path: input.path,
		rootFailureCode: "cannot_edit_root",
		tree: workspaceContext.tree,
	});

	if (resolution.status === "failed") {
		return {
			path: resolution.failure.path,
			warnings: [],
			...failedWorkspaceCapabilityEditResult(resolution.failure.code, input.edits.length),
		};
	}

	if (resolution.item.type !== "document") {
		return {
			path: resolution.path,
			warnings: [],
			...failedWorkspaceCapabilityEditResult("unsupported_item_type", input.edits.length),
		};
	}

	const documentSession = await getDocumentSession({
		itemId: resolution.item.id,
		workspaceId: capabilityContext.workspaceId,
	});

	const result = await documentSession.applyMarkdownEdits({
		edits: input.edits,
	});

	return {
		applied: result.applied,
		failed: result.failures,
		path: resolution.path,
		warnings: result.warnings,
	};
}

async function getDocumentSession(input: { itemId: string; workspaceId: string }) {
	const { env } = await import("cloudflare:workers");

	return getDocumentSessionFromEnv(env, input);
}

function failedWorkspaceCapabilityEditResult(
	code: EditWorkspaceCapabilityFailureCode,
	editCount: number,
): Pick<EditWorkspaceCapabilityItemResult, "applied" | "failed"> {
	return {
		applied: 0,
		failed: Array.from({ length: editCount }, (_, index) => ({
			code,
			index,
		})),
	};
}
