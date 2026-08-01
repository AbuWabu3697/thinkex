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
		staleTime: Number.POSITIVE_INFINITY,
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
