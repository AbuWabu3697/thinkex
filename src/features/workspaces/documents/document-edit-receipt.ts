import type { TiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";

export type DocumentEditReceiptStatus =
	| "content_changed"
	| "not_found"
	| "not_latest"
	| "ready"
	| "reverted"
	| "review_unavailable";

/** Every status a receipt can report once it is known not to be reviewable. */
export type DocumentEditReceiptUnavailableStatus = Exclude<DocumentEditReceiptStatus, "ready">;

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
			status: DocumentEditReceiptUnavailableStatus;
	  };

export type DocumentEditReceiptReviewRpcResult =
	| {
			afterContent: string;
			beforeContent: string;
			status: "ready";
	  }
	| {
			status: DocumentEditReceiptUnavailableStatus;
	  };

export interface DocumentEditReceiptUndoResult {
	status: DocumentEditReceiptUnavailableStatus;
}
