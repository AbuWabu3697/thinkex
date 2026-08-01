import type { TiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";

export const documentEditReceiptStatuses = [
	"ready",
	"reverted",
	"not_found",
	"not_latest",
	"content_changed",
	"review_unavailable",
] as const;

export type DocumentEditReceiptStatus = (typeof documentEditReceiptStatuses)[number];

export interface DocumentEditReceiptStatusResult {
	status: DocumentEditReceiptStatus;
}

export type DocumentEditReceiptReviewResult =
	| {
			afterDocument: TiptapDocumentJson;
			beforeDocument: TiptapDocumentJson;
			status: "ready";
	  }
	| {
			status: Exclude<DocumentEditReceiptStatus, "ready">;
	  };

export type DocumentEditReceiptReviewRpcResult =
	| {
			afterContent: string;
			beforeContent: string;
			status: "ready";
	  }
	| {
			status: Exclude<DocumentEditReceiptStatus, "ready">;
	  };

export interface DocumentEditReceiptUndoResult {
	status: Exclude<DocumentEditReceiptStatus, "ready">;
}
