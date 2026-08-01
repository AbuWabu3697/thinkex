import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type { DocumentEditReceiptUnavailableStatus } from "#/features/workspaces/documents/document-edit-receipt";
import { undoDocumentEditReceiptFn } from "#/features/workspaces/documents/document-edit-review-functions";
import {
	documentEditReceiptQueryKey,
	type DocumentEditReceiptTarget,
} from "#/features/workspaces/documents/document-edit-review-queries";

/**
 * Undo shared by the chat receipt and the review toolbar, so the same edits
 * revert the same way from either place.
 */
export function useDocumentEditReceiptUndo(target: DocumentEditReceiptTarget) {
	const queryClient = useQueryClient();
	const { hideReview } = useDocumentEditReview();

	return useMutation({
		mutationFn: () => undoDocumentEditReceiptFn({ data: target }),
		onSuccess: async (result) => {
			if (result.status === "reverted") {
				hideReview();
				toast.success("Changes undone.");
			} else {
				toast.error(undoUnavailableMessages[result.status]);
			}

			queryClient.setQueryData(documentEditReceiptQueryKey(target, "status"), result);
			await queryClient.invalidateQueries({
				queryKey: ["workspace-document-edit-receipt", target.workspaceId, target.itemId],
			});
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
