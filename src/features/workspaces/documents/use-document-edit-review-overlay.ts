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
	editor,
	itemId,
	viewInstanceId,
	workspaceId,
}: {
	editor: Editor | null;
	itemId: string;
	viewInstanceId: string;
	workspaceId: string;
}) {
	const { activeReview, hideReview } = useDocumentEditReview();
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

		// Only the state the marks were computed against can be marked truthfully.
		// After that the reader owns the session: edits map the marks rather than
		// ending review, and only Done closes it.
		const currentDocument = stringifyTiptapDocumentJson(coerceTiptapDocumentJson(editor.getJSON()));
		if (currentDocument !== stringifyTiptapDocumentJson(review.afterDocument)) {
			toast.error(unavailableReviewMessages.content_changed);
			hideReview();
			return;
		}

		showDocumentEditReview(editor, review.beforeDocument);

		return () => {
			hideDocumentEditReview(editor);
		};
	}, [editor, hideReview, reviewQuery.data, reviewQuery.isError, target]);
}

const unavailableReviewMessages: Record<DocumentEditReceiptUnavailableStatus, string> = {
	content_changed: "The document changed after this AI edit.",
	not_found: "These changes are no longer available.",
	not_latest: "Only the latest unchanged AI edit can be reviewed.",
	reverted: "These changes were already undone.",
	review_unavailable: "Change review is unavailable for this large document.",
};
