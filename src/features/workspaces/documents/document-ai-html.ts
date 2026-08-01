import { DOMParser, DOMSerializer, Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { parseHTML } from "linkedom";
import { nanoid } from "nanoid";

import {
	coerceTiptapDocumentJson,
	type TiptapDocumentJson,
} from "#/features/workspaces/documents/tiptap-document";
import {
	getTiptapDocumentSchema,
	tiptapDocumentAiRefAttribute,
} from "#/features/workspaces/documents/tiptap-schema";
import { sha256Base64UrlText } from "#/lib/binary";

const documentAiRefPattern = /^b_[A-Za-z0-9_-]{12}$/;
const documentAiTargetRefPattern = /^(b_[A-Za-z0-9_-]{12})\.r_[A-Za-z0-9_-]{10}$/;
const supportedDocumentAiHtmlTags = new Set([
	"a",
	"b",
	"blockquote",
	"br",
	"code",
	"col",
	"colgroup",
	"del",
	"div",
	"em",
	"h1",
	"h2",
	"h3",
	"hr",
	"i",
	"input",
	"label",
	"li",
	"mark",
	"ol",
	"p",
	"pre",
	"s",
	"span",
	"strike",
	"strong",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"u",
	"ul",
]);

export class DocumentAiHtmlError extends Error {}

export function parseDocumentAiHtml(html: string): TiptapDocumentJson {
	const htmlDocument = createHtmlDocument();
	htmlDocument.body.innerHTML = html;
	validateDocumentAiHtml(htmlDocument.body);

	for (const element of htmlDocument.body.querySelectorAll("[data-ref]")) {
		element.removeAttribute("data-ref");
	}

	try {
		const document = DOMParser.fromSchema(getTiptapDocumentSchema()).parse(
			htmlDocument.body as unknown as HTMLElement,
		);
		document.check();
		return coerceTiptapDocumentJson(document.toJSON());
	} catch (error) {
		throw new DocumentAiHtmlError("Document HTML does not match the supported schema.", {
			cause: error,
		});
	}
}

export async function serializeTiptapDocumentToAiHtml(document: TiptapDocumentJson) {
	const node = getTiptapDocumentSchema().nodeFromJSON(document);
	return (
		await Promise.all(
			Array.from({ length: node.childCount }, (_, index) =>
				serializeTiptapNodeToAiHtml(node.child(index)),
			),
		)
	).join("");
}

export async function serializeTiptapNodeToAiHtml(node: ProseMirrorNode) {
	return serializeTiptapFragmentToAiHtml(
		Fragment.from(withTiptapNodeAiRef(node, await createDocumentAiTargetRef(node))),
	);
}

export async function createDocumentAiTargetRef(node: ProseMirrorNode) {
	const ref = readTiptapNodeAiRef(node);
	if (!ref) {
		throw new Error(`Top-level document node ${node.type.name} is missing an AI ref.`);
	}

	const html = serializeTiptapFragmentToAiHtml(Fragment.from(withTiptapNodeAiRef(node, null)));
	const revision = (await sha256Base64UrlText(html)).slice(0, 10);
	return `${ref}.r_${revision}`;
}

export function parseDocumentAiTargetRef(ref: string) {
	return documentAiTargetRefPattern.exec(ref)?.[1] ?? null;
}

export function ensureTiptapDocumentAiRefs(document: TiptapDocumentJson): {
	changed: boolean;
	document: TiptapDocumentJson;
} {
	const refs = ensureProseMirrorDocumentAiRefs(getTiptapDocumentSchema().nodeFromJSON(document));
	return refs.changed
		? { changed: true, document: coerceTiptapDocumentJson(refs.document.toJSON()) }
		: { changed: false, document };
}

export function ensureProseMirrorDocumentAiRefs(document: ProseMirrorNode): {
	changed: boolean;
	document: ProseMirrorNode;
} {
	const usedRefs = new Set<string>();
	let changed = false;
	const children: ProseMirrorNode[] = [];

	document.forEach((node) => {
		const currentRef = readTiptapNodeAiRef(node);
		const ref = currentRef && !usedRefs.has(currentRef) ? currentRef : createDocumentAiRef();
		usedRefs.add(ref);
		changed ||= ref !== currentRef;
		children.push(withTiptapNodeAiRef(node, ref));
	});

	if (!changed) {
		return { changed: false, document };
	}

	return {
		changed: true,
		document: document.type.create(document.attrs, Fragment.fromArray(children)),
	};
}

export function createDocumentAiRef() {
	return `b_${nanoid(12)}`;
}

export function readTiptapNodeAiRef(node: ProseMirrorNode) {
	const ref = node.attrs[tiptapDocumentAiRefAttribute];
	return typeof ref === "string" && documentAiRefPattern.test(ref) ? ref : null;
}

export function withTiptapNodeAiRef(node: ProseMirrorNode, ref: string | null) {
	const attributes = node.type.spec.attrs;
	if (!attributes || !(tiptapDocumentAiRefAttribute in attributes)) {
		throw new Error(`Top-level document node ${node.type.name} cannot carry an AI ref.`);
	}

	return node.type.create(
		{ ...node.attrs, [tiptapDocumentAiRefAttribute]: ref },
		node.content,
		node.marks,
	);
}

function serializeTiptapFragmentToAiHtml(fragment: Fragment) {
	const htmlDocument = createHtmlDocument();
	const container = htmlDocument.createElement("div");
	const serialized = DOMSerializer.fromSchema(getTiptapDocumentSchema()).serializeFragment(
		fragment,
		{ document: htmlDocument as unknown as Document },
	);
	container.appendChild(serialized as unknown as globalThis.Node);
	return container.innerHTML;
}

function validateDocumentAiHtml(root: HTMLElement) {
	for (const element of root.querySelectorAll("*")) {
		const tagName = element.tagName.toLowerCase();
		if (!supportedDocumentAiHtmlTags.has(tagName) || !isSupportedSpecialElement(element)) {
			throw new DocumentAiHtmlError(`Unsupported document HTML element: <${tagName}>.`);
		}
	}
}

function isSupportedSpecialElement(element: Element) {
	const tagName = element.tagName.toLowerCase();
	if (tagName === "div") {
		return (
			element.getAttribute("data-type") === "block-math" ||
			element.parentElement?.getAttribute("data-type") === "taskItem"
		);
	}
	if (tagName === "span") {
		return (
			element.getAttribute("data-type") === "inline-math" ||
			element.parentElement?.tagName.toLowerCase() === "label"
		);
	}
	if (tagName === "label" || tagName === "input") {
		return Boolean(element.closest('li[data-type="taskItem"]'));
	}
	return true;
}

function createHtmlDocument() {
	return parseHTML("<!doctype html><html><body></body></html>").document;
}
