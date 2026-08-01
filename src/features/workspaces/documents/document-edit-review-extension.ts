import { Extension, type Editor } from "@tiptap/core";
import { ChangeSet, simplifyChanges, type TokenEncoder } from "@tiptap/pm/changeset";
import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { StepMap } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { TiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import {
	getTiptapDocumentSchema,
	tiptapDocumentAiRefAttribute,
} from "#/features/workspaces/documents/tiptap-schema";

const documentEditReviewPluginKey = new PluginKey<DecorationSet>("documentEditReview");
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
			new Plugin<DecorationSet>({
				key: documentEditReviewPluginKey,
				state: {
					init: () => DecorationSet.empty,
					apply(transaction, decorations, _oldState, newState) {
						const meta = transaction.getMeta(documentEditReviewPluginKey) as
							| DocumentEditReviewMeta
							| undefined;

						if (meta?.type === "hide" || (transaction.docChanged && !meta)) {
							return DecorationSet.empty;
						}
						if (meta?.type === "show") {
							return createDocumentEditReviewDecorations(meta.beforeDocument, newState.doc);
						}

						return decorations.map(transaction.mapping, transaction.doc);
					},
				},
				props: {
					decorations(state) {
						return documentEditReviewPluginKey.getState(state) ?? DecorationSet.empty;
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
			const isInlineChange = addInsertedContentDecoration(
				decorations,
				afterDocument,
				change.fromB,
				change.toB,
			);
			if (!isInlineChange) {
				addChangedBlockDecorations(
					decorations,
					decoratedBlocks,
					afterDocument,
					change.fromB,
					change.toB,
				);
			}
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

function addInsertedContentDecoration(
	decorations: Decoration[],
	document: ProseMirrorNode,
	from: number,
	to: number,
) {
	const start = document.resolve(from);
	const end = document.resolve(to);

	if (start.sameParent(end) && start.parent.inlineContent) {
		decorations.push(
			Decoration.inline(from, to, {
				class: "workspace-document-ai-inserted",
			}),
		);
		return true;
	}

	return false;
}

function addChangedBlockDecorations(
	decorations: Decoration[],
	decoratedBlocks: Set<string>,
	document: ProseMirrorNode,
	from: number,
	to: number,
) {
	document.forEach((node, offset) => {
		const end = offset + node.nodeSize;
		if (end <= from || offset >= to) {
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

function createDeletedContentWidget(beforeDocument: ProseMirrorNode, from: number, to: number) {
	const deletedText = beforeDocument.textBetween(from, to, " ").trim();
	const element = document.createElement("span");
	const visibleText = deletedText || "Removed block";

	element.className = "workspace-document-ai-deleted";
	element.contentEditable = "false";
	element.textContent =
		visibleText.length > maximumDeletedTextLength
			? `${visibleText.slice(0, maximumDeletedTextLength)}…`
			: visibleText;

	return element;
}

function encodeMark(mark: Mark) {
	return `${mark.type.name}:${JSON.stringify(mark.attrs)}`;
}
