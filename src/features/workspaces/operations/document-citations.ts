import {
	applyDocumentCitationLocations,
	readDocumentCitationRefs,
} from "#/features/workspaces/documents/document-ai-html";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";
import { getWorkspacePathName } from "#/features/workspaces/kernel/workspace-kernel-paths";
import type { WorkspaceAccessContext } from "#/features/workspaces/operations/workspace-access-context";

/**
 * Turn the refs an assistant cited into the sources a document can keep.
 *
 * The assistant cites `wr_` refs, the same way it cites in a chat reply, but a
 * ref only means something inside the turn that produced it. Resolving here
 * lets the document store the item and page it points at, named as the reader
 * knows it.
 */
export async function resolveDocumentCitations(input: {
	context: WorkspaceAccessContext;
	html: string;
	kernel: WorkspaceKernelClient;
}): Promise<string> {
	const refs = readDocumentCitationRefs(input.html);

	if (refs.length === 0 || !input.context.resolveWorkspaceReferences) {
		return input.html;
	}

	const records = await input.context.resolveWorkspaceReferences(refs);

	// A ref the assistant invented or carried over from an older turn resolves to
	// nothing, and there are no items left to name.
	if (records.length === 0) {
		return input.html;
	}

	const itemPaths = await input.kernel.getItemPaths({
		itemIds: [...new Set(records.map((record) => record.location.itemId))],
	});
	const namesByItemId = new Map(
		itemPaths.map((item) => [item.itemId, getWorkspacePathName(item.path)]),
	);

	return applyDocumentCitationLocations(
		input.html,
		new Map(
			records.flatMap((record) => {
				const name = namesByItemId.get(record.location.itemId);
				if (!name) {
					return [];
				}

				return [
					[
						record.ref,
						{
							label:
								record.location.kind === "pdf-page"
									? `${name}, p. ${record.location.pageNumber}`
									: name,
							location: record.location,
						},
					] as const,
				];
			}),
		),
	);
}
