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
 * Line tally for an AI edit, counted once against the two versions of the
 * document that edit sat between. A line is one text block — a paragraph, a
 * heading, a single list item — so a rewritten paragraph reads as one line out
 * and one line in.
 */
export interface DocumentEditLineChanges {
	added: number;
	removed: number;
}

export type DocumentEditReceiptReviewResult =
	| {
			beforeDocument: TiptapDocumentJson;
			status: "ready";
	  }
	| {
			status: DocumentEditReceiptUnavailableStatus;
	  };

export type DocumentEditReceiptReviewRpcResult =
	| {
			beforeContent: string;
			status: "ready";
	  }
	| {
			status: DocumentEditReceiptUnavailableStatus;
	  };

/** Identifies one turn's edits to one document. */
export interface DocumentEditReceiptTarget {
	itemId: string;
	receiptIds: string[];
	workspaceId: string;
}

export interface DocumentEditReceiptUndoResult {
	status: DocumentEditReceiptUnavailableStatus;
}
