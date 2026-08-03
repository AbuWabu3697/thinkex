import { Extension, type Editor } from "@tiptap/core";
import { ChangeSet, simplifyChanges, type TokenEncoder } from "@tiptap/pm/changeset";
import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import katex from "katex";

import type { TiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import {
	getTiptapDocumentSchema,
	tiptapDocumentAiRefAttribute,
} from "#/features/workspaces/documents/tiptap-schema";

/**
 * Review state holds the document as it was before the edit, not the marks it
 * produced. Marks are derived from it against whatever is on screen right now,
 * so they are correct no matter when the document arrives — a reopened tab
 * syncing its content, or a collaborator typing mid-review.
 */
interface DocumentEditReviewState {
	beforeDocument: TiptapDocumentJson;
	decorations: DecorationSet;
}

const documentEditReviewPluginKey = new PluginKey<DocumentEditReviewState | null>(
	"documentEditReview",
);
const maximumDeletedTextLength = 240;

type DocumentEditReviewMeta =
	| { beforeDocument: TiptapDocumentJson; type: "show" }
	| { type: "hide" };

const documentEditTokenEncoder: TokenEncoder<string> = {
	encodeCharacter(character, marks) {
		return `c:${character}:${marks.map(encodeMark).sort().join("|")}`;
	},
	encodeNodeStart(node) {
		const attributes = { ...node.attrs };
		delete attributes[tiptapDocumentAiRefAttribute];
		return `n:${node.type.name}:${JSON.stringify(attributes)}`;
	},
	encodeNodeEnd(node) {
		return `/n:${node.type.name}`;
	},
	compareTokens(left, right) {
		return left === right;
	},
};

export const DocumentEditReviewExtension = Extension.create({
	name: "documentEditReview",

	addProseMirrorPlugins() {
		return [
			new Plugin<DocumentEditReviewState | null>({
				key: documentEditReviewPluginKey,
				state: {
					init: () => null,
					apply(transaction, review, _oldState, newState) {
						const meta = transaction.getMeta(documentEditReviewPluginKey) as
							| DocumentEditReviewMeta
							| undefined;
						const beforeDocument =
							meta?.type === "show" ? meta.beforeDocument : review?.beforeDocument;

						if (meta?.type === "hide" || !beforeDocument) {
							return null;
						}
						if (meta?.type !== "show" && !transaction.docChanged) {
							return review;
						}

						return {
							beforeDocument,
							decorations: createDocumentEditReviewDecorations(beforeDocument, newState.doc),
						};
					},
				},
				props: {
					decorations(state) {
						return documentEditReviewPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
					},
				},
			}),
		];
	},
});

export function showDocumentEditReview(editor: Editor, beforeDocument: TiptapDocumentJson) {
	editor.view.dispatch(
		editor.state.tr
			.setMeta(documentEditReviewPluginKey, {
				beforeDocument,
				type: "show",
			} satisfies DocumentEditReviewMeta)
			.setMeta("addToHistory", false),
	);
}

export function hideDocumentEditReview(editor: Editor) {
	editor.view.dispatch(
		editor.state.tr
			.setMeta(documentEditReviewPluginKey, {
				type: "hide",
			} satisfies DocumentEditReviewMeta)
			.setMeta("addToHistory", false),
	);
}

function createDocumentEditReviewDecorations(
	beforeDocument: TiptapDocumentJson,
	afterDocument: ProseMirrorNode,
) {
	const beforeNode = getTiptapDocumentSchema().nodeFromJSON(beforeDocument);
	const changes = simplifyChanges(
		ChangeSet.create(beforeNode, undefined, documentEditTokenEncoder).addSteps(
			afterDocument,
			[new StepMap([0, beforeNode.content.size, afterDocument.content.size])],
			null,
		).changes,
		afterDocument,
	);
	const decorations: Decoration[] = [];
	const decoratedBlocks = new Set<string>();

	for (const [index, change] of changes.entries()) {
		if (change.fromB < change.toB) {
			// Inline decorations already span block boundaries, marking the text
			// inside each one. Only blocks that carry no text of their own — a rule,
			// a rendered formula — need a decoration of their own to be visible.
			decorations.push(
				Decoration.inline(change.fromB, change.toB, {
					class: "workspace-document-ai-inserted",
				}),
			);
			addChangedAtomDecorations(
				decorations,
				decoratedBlocks,
				afterDocument,
				change.fromB,
				change.toB,
			);
		}

		if (change.fromA < change.toA) {
			decorations.push(
				Decoration.widget(
					change.fromB,
					() => createDeletedContentWidget(beforeNode, change.fromA, change.toA),
					{ key: `document-edit-deletion-${index}`, side: -1 },
				),
			);
		}
	}

	return DecorationSet.create(afterDocument, decorations);
}

function addChangedAtomDecorations(
	decorations: Decoration[],
	decoratedBlocks: Set<string>,
	document: ProseMirrorNode,
	from: number,
	to: number,
) {
	document.forEach((node, offset) => {
		const end = offset + node.nodeSize;
		if (end <= from || offset >= to || !node.isAtom) {
			return;
		}

		const key = `${offset}:${end}`;
		if (decoratedBlocks.has(key)) {
			return;
		}

		decoratedBlocks.add(key);
		decorations.push(
			Decoration.node(offset, end, {
				class: "workspace-document-ai-changed-block",
			}),
		);
	});
}

export function createDeletedContentWidget(
	beforeDocument: ProseMirrorNode,
	from: number,
	to: number,
) {
	const deletedText = beforeDocument.textBetween(from, to, " ").trim();
	const element = document.createElement("span");

	element.className = "workspace-document-ai-deleted";
	element.contentEditable = "false";

	if (!deletedText && renderDeletedMath(beforeDocument, from, to, element)) {
		return element;
	}

	const visibleText = deletedText || "Removed block";
	element.textContent =
		visibleText.length > maximumDeletedTextLength
			? `${visibleText.slice(0, maximumDeletedTextLength)}…`
			: visibleText;

	return element;
}

function renderDeletedMath(
	beforeDocument: ProseMirrorNode,
	from: number,
	to: number,
	element: HTMLElement,
) {
	let mathNode: ProseMirrorNode | undefined;

	beforeDocument.nodesBetween(from, to, (node) => {
		if (node.type.name === "inlineMath" || node.type.name === "blockMath") {
			mathNode = node;
			return false;
		}
	});

	if (!mathNode) {
		return false;
	}

	const latex = typeof mathNode.attrs.latex === "string" ? mathNode.attrs.latex : "";
	katex.render(latex, element, {
		displayMode: mathNode.type.name === "blockMath",
		throwOnError: false,
	});
	return true;
}

function encodeMark(mark: Mark) {
	return `${mark.type.name}:${JSON.stringify(mark.attrs)}`;
}
