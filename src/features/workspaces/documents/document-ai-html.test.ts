import { describe, expect, it } from "vitest";

import {
	DocumentAiHtmlError,
	ensureTiptapDocumentAiRefs,
	parseDocumentAiHtml,
	serializeTiptapDocumentToAiHtml,
} from "#/features/workspaces/documents/document-ai-html";

describe("document AI HTML", () => {
	it("round-trips supported rich content through the Tiptap schema", async () => {
		const document = ensureTiptapDocumentAiRefs(
			parseDocumentAiHtml(
				'<h1>Notes</h1><p>Use <strong>bold</strong>, <a href="https://thinkex.app">links</a>, and <span data-type="inline-math" data-latex="x^2"></span>.</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input checked type="checkbox"><span></span></label><div><p>Done</p></div></li></ul>',
			),
		).document;
		const html = await serializeTiptapDocumentToAiHtml(document);

		expect(html).toMatch(/^<h1 data-ref="b_[A-Za-z0-9_-]{12}\.r_[A-Za-z0-9_-]{10}">Notes<\/h1>/);
		expect(html).toContain("<strong>bold</strong>");
		expect(html).toContain('data-type="inline-math"');
		expect(html).toContain('data-type="taskItem"');
		expect(parseDocumentAiHtml(html)).toMatchObject({ type: "doc" });
	});

	it("ignores refs supplied in model-authored HTML", async () => {
		const html = await serializeTiptapDocumentToAiHtml(
			ensureTiptapDocumentAiRefs(parseDocumentAiHtml('<p data-ref="b_modelchosen1">Hello</p>'))
				.document,
		);

		expect(html).not.toContain("b_modelchosen1");
		expect(html).toMatch(/data-ref="b_[A-Za-z0-9_-]{12}\.r_[A-Za-z0-9_-]{10}"/);
	});

	it("normalizes malformed but recoverable HTML", () => {
		const document = parseDocumentAiHtml("<p>Hello <strong>world</p><ul><li>One<li>Two</ul>");

		expect(document).toMatchObject({
			content: [
				{ type: "paragraph" },
				{ content: [{ type: "listItem" }, { type: "listItem" }], type: "bulletList" },
			],
			type: "doc",
		});
	});

	it("keeps only schema-supported attributes and safe links", async () => {
		const document = ensureTiptapDocumentAiRefs(
			parseDocumentAiHtml(
				'<p class="ignored" data-extra="ignored" onclick="alert(1)"><a href="javascript:alert(1)" title="ignored">Unsafe</a></p>',
			),
		).document;

		const html = await serializeTiptapDocumentToAiHtml(document);
		expect(html).not.toContain("class=");
		expect(html).not.toContain("data-extra");
		expect(html).not.toContain("onclick");
		expect(html).not.toContain("javascript:");
		expect(html).toContain(">Unsafe</p>");
	});

	it("rejects elements outside the supported document schema", () => {
		expect(() => parseDocumentAiHtml("<figure><p>Unsupported</p></figure>")).toThrow(
			DocumentAiHtmlError,
		);
		expect(() => parseDocumentAiHtml("<div>Not a math or task wrapper</div>")).toThrow(
			DocumentAiHtmlError,
		);
	});
});
