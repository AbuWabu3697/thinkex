import { DOMParser, DOMSerializer, Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { parseHTML } from "linkedom";
import { nanoid } from "nanoid";

import type { WorkspaceLocation } from "#/features/workspaces/locations/workspace-location";
import {
	coerceTiptapDocumentJson,
	type TiptapDocumentJson,
} from "#/features/workspaces/documents/tiptap-document";
import {
	getTiptapDocumentSchema,
	tiptapDocumentAiRefAttribute,
} from "#/features/workspaces/documents/tiptap-schema";
import { sha256Base64UrlText } from "#/lib/binary";

const TEXT_NODE = 3;
const documentAiRefPattern = /^b_[A-Za-z0-9_-]{12}$/;
const documentAiTargetRefPattern = /^(b_[A-Za-z0-9_-]{12})\.r_[A-Za-z0-9_-]{10}$/;
const supportedDocumentAiHtmlTags = new Set([
	"a",
	"b",
	"blockquote",
	"br",
	"citation",
	"code",
	"col",
	"colgroup",
	"del",
	"div",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
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

	// A citation the operation could not resolve to a real item cannot navigate
	// anywhere, so it becomes its own label rather than failing the write.
	for (const element of htmlDocument.body.querySelectorAll("citation:not([data-item-id])")) {
		element.replaceWith(htmlDocument.createTextNode(element.textContent ?? ""));
	}

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

	// Fingerprint the block's JSON rather than its HTML: rendering costs a whole
	// second DOM pass per block per read, and the ref only has to change whenever
	// the block's content does.
	const content = JSON.stringify(withTiptapNodeAiRef(node, null).toJSON());
	const revision = (await sha256Base64UrlText(content)).slice(0, 10);
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
	// Text sitting at the top level means this is not HTML at all — Markdown,
	// most often, which a model reaches for by habit. ProseMirror would take it
	// without complaint and flatten the whole thing into one paragraph of
	// literal source, so refuse it while the edit can still be reported failed.
	for (const node of root.childNodes) {
		if (node.nodeType === TEXT_NODE && node.textContent?.trim()) {
			throw new DocumentAiHtmlError(
				"Document content must be HTML elements. Plain text and Markdown are not accepted.",
			);
		}
	}

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

/** Short refs the assistant cited, for the caller to resolve to locations. */
export function readDocumentCitationRefs(html: string) {
	const htmlDocument = createHtmlDocument();
	htmlDocument.body.innerHTML = html;

	return [
		...new Set(
			[...htmlDocument.body.querySelectorAll("citation[ref]")].flatMap(
				(element) => element.getAttribute("ref") ?? [],
			),
		),
	];
}

/**
 * Rewrite cited refs to the locations they stand for. A ref belongs to one chat
 * turn; the location outlives it, so that is what the document keeps.
 */
export function applyDocumentCitationLocations(
	html: string,
	citationsByRef: Map<string, { label: string; location: WorkspaceLocation }>,
) {
	const htmlDocument = createHtmlDocument();
	htmlDocument.body.innerHTML = html;

	for (const element of htmlDocument.body.querySelectorAll("citation[ref]")) {
		const citation = citationsByRef.get(element.getAttribute("ref") ?? "");
		element.removeAttribute("ref");

		if (!citation) {
			continue;
		}
		element.setAttribute("data-item-id", citation.location.itemId);
		if (citation.location.kind === "pdf-page") {
			element.setAttribute("data-page", String(citation.location.pageNumber));
		}
		// The citation prompt tells the assistant to leave the element empty, so
		// the source names itself here rather than being asked for twice.
		element.textContent = citation.label;
	}

	return htmlDocument.body.innerHTML;
}

function createHtmlDocument() {
	return parseHTML("<!doctype html><html><body></body></html>").document;
}
