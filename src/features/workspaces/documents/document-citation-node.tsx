import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

import { WorkspaceCitation } from "#/features/workspaces/components/ai-chat/WorkspaceCitation";
import { Citation } from "#/features/workspaces/documents/tiptap-schema";

/**
 * The editor's citation: the same chip a chat reply shows, over the same
 * location. Names are read from the workspace as it stands, so renaming a
 * source renames every citation of it, and a deleted one says so.
 */
export const DocumentCitation = Citation.extend({
	addNodeView() {
		return ReactNodeViewRenderer(DocumentCitationView, { as: "span" });
	},
});

function DocumentCitationView({ node }: { node: { attrs: Record<string, unknown> } }) {
	const itemId = typeof node.attrs.itemId === "string" ? node.attrs.itemId : null;
	const pageNumber = typeof node.attrs.pageNumber === "number" ? node.attrs.pageNumber : null;

	return (
		<NodeViewWrapper as="span" contentEditable={false}>
			{itemId ? (
				<WorkspaceCitation
					location={
						pageNumber
							? { itemId, kind: "pdf-page", pageNumber, version: 1 }
							: { itemId, kind: "item", version: 1 }
					}
				/>
			) : null}
		</NodeViewWrapper>
	);
}
