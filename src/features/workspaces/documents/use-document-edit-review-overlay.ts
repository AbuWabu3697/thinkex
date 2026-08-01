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
	viewInstanceId,
	workspaceId,
}: {
	canEdit: boolean;
	editor: Editor | null;
	itemId: string;
	viewInstanceId: string;
	workspaceId: string;
}) {
	const { activeReview, endReviewForView, hideReview } = useDocumentEditReview();
	const target =
		activeReview?.itemId === itemId && activeReview.viewInstanceId === viewInstanceId
			? activeReview
			: null;
	const reviewQuery = useQuery({
		...documentEditReceiptReviewQueryOptions({
			itemId,
			receiptIds: target?.receiptIds ?? ["inactive"],
			workspaceId,
		}),
		enabled: Boolean(editor && target),
	});
	// Review belongs to this open view. Closing the document ends it, rather than
	// leaving a session pointing at a view that no longer exists.
	useEffect(
		() => () => {
			endReviewForView({ itemId, viewInstanceId });
		},
		[endReviewForView, itemId, viewInstanceId],
	);
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
		if (review.status !== "ready") {
			toast.error(unavailableReviewMessages[review.status]);
			hideReview();
			return;
		}

		// Staleness is the server's call: it compares the live document against the
		// receipt and reports content_changed above. Re-checking here against a
		// just-opened editor only catches it mid-sync and refuses to show anything.

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
