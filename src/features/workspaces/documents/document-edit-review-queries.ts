import { queryOptions } from "@tanstack/react-query";

import { getDocumentEditReceiptReviewFn } from "#/features/workspaces/documents/document-edit-review-functions";

export interface DocumentEditReceiptTarget {
	itemId: string;
	receiptIds: string[];
	workspaceId: string;
}

export interface DocumentEditReviewTarget extends DocumentEditReceiptTarget {
	/** When this review was opened. */
	openedAt: number;
}

export function documentEditReceiptReviewQueryOptions(target: DocumentEditReviewTarget) {
	return queryOptions({
		// The open is part of the key. This response is a judgement about the
		// document as it stood when it was fetched, so an answer from an earlier
		// open must not be reachable: it would mark the reader's own later writing
		// as the assistant's.
		queryKey: [
			"workspace-document-edit-review",
			target.workspaceId,
			target.itemId,
			target.receiptIds.join(":"),
			target.openedAt,
		],
		queryFn: () =>
			getDocumentEditReceiptReviewFn({
				data: {
					itemId: target.itemId,
					receiptIds: target.receiptIds,
					workspaceId: target.workspaceId,
				},
			}),
		// Nothing outlives its open, so an entry is dead the moment the key moves.
		gcTime: 0,
	});
}
