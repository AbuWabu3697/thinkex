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
import {
	coerceTiptapDocumentJson,
	stringifyTiptapDocumentJson,
} from "#/features/workspaces/documents/tiptap-document";

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

		// The marks only describe the document as it was when they were computed.
		const currentDocument = stringifyTiptapDocumentJson(coerceTiptapDocumentJson(editor.getJSON()));
		if (currentDocument !== stringifyTiptapDocumentJson(review.afterDocument)) {
			toast.error(unavailableReviewMessages.content_changed);
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
