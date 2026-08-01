import { queryOptions } from "@tanstack/react-query";

import {
	getDocumentEditReceiptReviewFn,
	getDocumentEditReceiptStatusFn,
} from "#/features/workspaces/documents/document-edit-review-functions";

export interface DocumentEditReceiptTarget {
	itemId: string;
	receiptIds: string[];
	workspaceId: string;
}

export function documentEditReceiptStatusQueryOptions(target: DocumentEditReceiptTarget) {
	return queryOptions({
		queryKey: documentEditReceiptQueryKey(target, "status"),
		queryFn: () => getDocumentEditReceiptStatusFn({ data: target }),
		staleTime: 5_000,
	});
}

export function documentEditReceiptReviewQueryOptions(target: DocumentEditReceiptTarget) {
	return queryOptions({
		queryKey: documentEditReceiptQueryKey(target, "review"),
		queryFn: () => getDocumentEditReceiptReviewFn({ data: target }),
		// Deliberately not cached. This response carries the server's verdict on
		// whether the document still matches the receipt, and a verdict cached
		// from an earlier open would mark the reader's own later writing as the
		// assistant's.
		staleTime: 0,
	});
}

export function documentEditReceiptQueryKey(
	target: DocumentEditReceiptTarget,
	kind: "review" | "status",
) {
	return [
		"workspace-document-edit-receipt",
		target.workspaceId,
		target.itemId,
		target.receiptIds.join(":"),
		kind,
	] as const;
}
