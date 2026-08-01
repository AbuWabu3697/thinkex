import { queryOptions } from "@tanstack/react-query";

import { getDocumentEditReceiptReviewFn } from "#/features/workspaces/documents/document-edit-review-functions";

export interface DocumentEditReceiptTarget {
	itemId: string;
	receiptIds: string[];
	workspaceId: string;
}

export function documentEditReceiptReviewQueryOptions(target: DocumentEditReceiptTarget) {
	return queryOptions({
		queryKey: [
			"workspace-document-edit-review",
			target.workspaceId,
			target.itemId,
			target.receiptIds.join(":"),
		],
		queryFn: () => getDocumentEditReceiptReviewFn({ data: target }),
		// Deliberately not cached. This response carries the server's verdict on
		// whether the document still matches the receipt, and a verdict cached
		// from an earlier open would mark the reader's own later writing as the
		// assistant's.
		staleTime: 0,
	});
}
