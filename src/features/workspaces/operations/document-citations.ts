import {
	applyDocumentCitationLocations,
	readDocumentCitationRefs,
} from "#/features/workspaces/documents/document-ai-html";
import type { WorkspaceAccessContext } from "#/features/workspaces/operations/workspace-access-context";

/**
 * Turn the refs an assistant cited into the locations a document can keep.
 *
 * The assistant cites `wr_` refs, the same way it cites in a chat reply, but a
 * ref only means something inside the turn that produced it. Resolving here
 * lets the document store the item and page it actually points at.
 */
export async function resolveDocumentCitations(input: {
	context: WorkspaceAccessContext;
	html: string;
}): Promise<string> {
	const refs = readDocumentCitationRefs(input.html);

	if (refs.length === 0 || !input.context.resolveWorkspaceReferences) {
		return input.html;
	}

	const records = await input.context.resolveWorkspaceReferences(refs);
	const locationsByRef = new Map(
		records.flatMap((record) =>
			record.location.kind === "item" || record.location.kind === "pdf-page"
				? [
						[
							record.ref,
							{
								itemId: record.location.itemId,
								...(record.location.kind === "pdf-page"
									? { pageNumber: record.location.pageNumber }
									: {}),
							},
						] as const,
					]
				: [],
		),
	);

	return applyDocumentCitationLocations(input.html, locationsByRef);
}
