import type { Editor } from "@tiptap/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type { DocumentEditReceiptUnavailableStatus } from "#/features/workspaces/documents/document-edit-receipt";
import {
	hideDocumentEditReview,
	showDocumentEditReview,
} from "#/features/workspaces/documents/document-edit-review-extension";
import { documentEditReceiptReviewQueryOptions } from "#/features/workspaces/documents/document-edit-review-queries";

export function useDocumentEditReviewOverlay({
	canEdit,
	editor,
	itemId,
	workspaceId,
}: {
	canEdit: boolean;
	editor: Editor | null;
	itemId: string;
	workspaceId: string;
}) {
	const { activeReview, hideReview } = useDocumentEditReview();
	// Any mounted view of this document shows the marks, so a review opened
	// before the document was on screen still applies once it mounts.
	const target = activeReview?.itemId === itemId ? activeReview : null;
	const reviewQuery = useQuery({
		...documentEditReceiptReviewQueryOptions({
			itemId,
			receiptIds: target?.receiptIds ?? ["inactive"],
			workspaceId,
		}),
		enabled: Boolean(editor && target),
	});
	useEffect(() => {
		if (!editor || !target) {
			return;
		}

		if (reviewQuery.isError) {
			toast.error("Could not load these changes.");
			hideReview();
			return;
		}

		const review = reviewQuery.data;
		if (!review) {
			return;
		}
		// Staleness is the server's call: it compares the live document against the
		// receipt and reports it here. Re-checking against a just-opened editor
		// would only catch it mid-sync and refuse to show anything.
		if (review.status !== "ready") {
			toast.error(unavailableReviewMessages[review.status]);
			hideReview();
			return;
		}

		// Reviewing is a reading mode: hold the document still until Done rather
		// than deciding what a keystroke mid-review was supposed to mean.
		showDocumentEditReview(editor, review.beforeDocument);
		editor.setEditable(false);

		return () => {
			hideDocumentEditReview(editor);
			editor.setEditable(canEdit);
		};
	}, [canEdit, editor, hideReview, reviewQuery.data, reviewQuery.isError, target]);
}

const unavailableReviewMessages: Record<DocumentEditReceiptUnavailableStatus, string> = {
	content_changed: "The document changed after this AI edit.",
	not_found: "These changes are no longer available.",
	not_latest: "Only the latest unchanged AI edit can be reviewed.",
	reverted: "These changes were already undone.",
	review_unavailable: "Change review is unavailable for this large document.",
};
