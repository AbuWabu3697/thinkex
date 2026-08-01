import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type {
	DocumentEditReceiptTarget,
	DocumentEditReceiptUnavailableStatus,
} from "#/features/workspaces/documents/document-edit-receipt";
import { undoDocumentEditReceiptFn } from "#/features/workspaces/documents/document-edit-review-functions";

/**
 * Undo shared by the chat receipt and the review toolbar, so the same edits
 * revert the same way from either place.
 */
export function useDocumentEditReceiptUndo(target: DocumentEditReceiptTarget) {
	const { hideReview } = useDocumentEditReview();

	return useMutation({
		mutationFn: () => undoDocumentEditReceiptFn({ data: target }),
		onSuccess: (result) => {
			// Every outcome ends the review: it either just undid the changes, or
			// told us they no longer describe the document. Leaving the marks up
			// after that would be showing a diff we have just been told is wrong.
			hideReview();

			if (result.status === "reverted") {
				toast.success("Changes undone.");
			} else {
				toast.error(undoUnavailableMessages[result.status]);
			}
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Could not undo these changes.");
		},
	});
}

const undoUnavailableMessages: Record<DocumentEditReceiptUnavailableStatus, string> = {
	content_changed: "This document changed after these edits, so they were not undone.",
	not_found: "These changes are no longer available.",
	not_latest: "Undo the newer changes first.",
	reverted: "These changes were already undone.",
	review_unavailable: "Undo is unavailable for this large document.",
};
