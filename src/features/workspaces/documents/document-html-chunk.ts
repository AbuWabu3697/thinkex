import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { serializeTiptapNodeToAiHtml } from "#/features/workspaces/documents/document-ai-html";

// Roughly 12k tokens for ordinary prose: useful working context without making
// one document read dominate the model's turn.
const targetDocumentChunkCharacters = 48_000;

export interface DocumentHtmlChunk {
	content: string;
	location: {
		endBlock: number;
		startBlock: number;
		totalBlocks: number;
	};
	nextOffset?: number;
}

export interface DocumentHtmlChunkReadInput {
	expectedRevision?: string;
	offset: number;
}

export type DocumentHtmlChunkReadResult =
	| { status: "content_changed" }
	| { status: "invalid_offset" }
	| ({ revision: string; status: "ready" } & DocumentHtmlChunk);

export async function readDocumentHtmlChunk(
	document: ProseMirrorNode,
	offset: number,
): Promise<DocumentHtmlChunk | undefined> {
	if (offset < 0 || offset >= document.childCount) {
		return undefined;
	}

	const content: string[] = [];
	let characters = 0;
	let endOffset = offset;
	while (endOffset < document.childCount) {
		const block = await serializeTiptapNodeToAiHtml(document.child(endOffset));
		const separatorCharacters = content.length > 0 ? 1 : 0;
		if (
			content.length > 0 &&
			characters + separatorCharacters + block.length > targetDocumentChunkCharacters
		) {
			break;
		}

		content.push(block);
		characters += separatorCharacters + block.length;
		endOffset++;
	}

	return {
		content: content.join("\n"),
		location: {
			endBlock: endOffset,
			startBlock: offset + 1,
			totalBlocks: document.childCount,
		},
		...(endOffset < document.childCount ? { nextOffset: endOffset } : {}),
	};
}
