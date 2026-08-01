import type { Editor } from "@tiptap/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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
	const hasShownReview = useRef(false);

	useEffect(() => {
		if (!editor || !target) {
			hasShownReview.current = false;
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

		const expectedDocument = stringifyTiptapDocumentJson(review.afterDocument);
		const syncReview = () => {
			const currentDocument = stringifyTiptapDocumentJson(
				coerceTiptapDocumentJson(editor.getJSON()),
			);

			if (currentDocument === expectedDocument) {
				showDocumentEditReview(editor, review.beforeDocument);
				hasShownReview.current = true;
			} else if (hasShownReview.current) {
				hideReview();
			}
		};

		syncReview();
		editor.on("update", syncReview);

		return () => {
			editor.off("update", syncReview);
			hideDocumentEditReview(editor);
			hasShownReview.current = false;
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
