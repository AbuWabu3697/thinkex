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

/**
 * Block-level tally of what an AI edit did, counted against the document as it
 * stands now. Blocks, not lines: a document has no lines, and a block is the
 * same unit the model targets, so the count matches what review highlights.
 */
export interface DocumentEditBlockChanges {
	added: number;
	edited: number;
	removed: number;
}

export interface DocumentEditReceiptStatusResult {
	changes?: DocumentEditBlockChanges;
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
