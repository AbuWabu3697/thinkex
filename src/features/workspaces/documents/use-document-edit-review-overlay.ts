import type { Editor } from "@tiptap/core";
import { useEffect } from "react";

import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import {
	hideDocumentEditReview,
	showDocumentEditReview,
} from "#/features/workspaces/documents/document-edit-review-extension";

export function useDocumentEditReviewOverlay({
	canEdit,
	editor,
	itemId,
}: {
	canEdit: boolean;
	editor: Editor | null;
	itemId: string;
}) {
	const { activeReview } = useDocumentEditReview();
	// Any mounted view of this document shows the marks, so a review opened
	// before the document was on screen still applies once it mounts.
	const target = activeReview?.itemId === itemId ? activeReview : null;

	useEffect(() => {
		if (!editor || !target) {
			return;
		}

		// Reviewing is a reading mode: hold the document still until Done rather
		// than deciding what a keystroke mid-review was supposed to mean.
		showDocumentEditReview(editor, target.beforeDocument);
		editor.setEditable(false);

		return () => {
			hideDocumentEditReview(editor);
			editor.setEditable(canEdit);
		};
	}, [canEdit, editor, target]);
}
