import {
	applyDocumentCitationSources,
	readDocumentCitationSubjects,
} from "#/features/workspaces/documents/document-ai-html";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";
import { getWorkspacePathName } from "#/features/workspaces/kernel/workspace-kernel-paths";
import type { WorkspaceAccessContext } from "#/features/workspaces/operations/workspace-access-context";

/**
 * Turn the refs an assistant cited into the sources a document can keep, and
 * make sure every citation in the document is named after its source.
 *
 * The assistant cites `wr_` refs, the same way it cites in a chat reply, but a
 * ref only means something inside the turn that produced it. Resolving here
 * lets the document store the item and page it points at.
 */
export async function resolveDocumentCitations(input: {
	context: WorkspaceAccessContext;
	html: string;
	kernel: WorkspaceKernelClient;
}): Promise<string> {
	const { refs, unnamedItemIds } = readDocumentCitationSubjects(input.html);

	if (refs.length === 0 && unnamedItemIds.length === 0) {
		return input.html;
	}

	const records =
		refs.length > 0 && input.context.resolveWorkspaceReferences
			? await input.context.resolveWorkspaceReferences(refs)
			: [];
	const itemIds = [
		...new Set([...records.map((record) => record.location.itemId), ...unnamedItemIds]),
	];

	if (itemIds.length === 0) {
		return input.html;
	}

	const itemPaths = await input.kernel.getItemPaths({ itemIds });

	return applyDocumentCitationSources(input.html, {
		locationsByRef: new Map(records.map((record) => [record.ref, record.location])),
		namesByItemId: new Map(itemPaths.map((item) => [item.itemId, getWorkspacePathName(item.path)])),
	});
}
