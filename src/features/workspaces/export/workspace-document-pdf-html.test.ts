import { describe, expect, it } from "vitest";

import type { TiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import { renderWorkspaceDocumentPdfHtml } from "#/features/workspaces/export/workspace-document-pdf-html";

describe("renderWorkspaceDocumentPdfHtml", () => {
	it("renders printable prose, math, and highlighted wrapping code without citations or widgets", async () => {
		const document: TiptapDocumentJson = {
			type: "doc",
			content: [
				{
					type: "heading",
					attrs: { level: 1 },
					content: [{ type: "text", text: "Export title" }],
				},
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Euler says " },
						{ type: "inlineMath", attrs: { latex: "e^{i\\pi}+1=0" } },
						{ type: "citation", attrs: { itemId: "source-1", pageNumber: 4 } },
					],
				},
				{
					type: "codeBlock",
					attrs: { language: "javascript" },
					content: [
						{
							type: "text",
							text: "const longLine = 'this should wrap instead of being clipped';",
						},
					],
				},
				{
					type: "blockMath",
					attrs: { latex: "\\int_0^1 x^2 dx = \\frac{1}{3}" },
				},
				{
					type: "widget",
					attrs: { title: "Private widget" },
					content: [{ type: "text", text: "widget-secret-source" }],
				},
			],
		};

		const html = await renderWorkspaceDocumentPdfHtml(document);

		expect(html).toContain("Export title");
		expect(html).toContain("<math");
		expect(html).toContain("JavaScript");
		expect(html).toContain('style="color: #');
		expect(html).toContain("white-space: pre-wrap");
		expect(html).not.toContain("<citation");
		expect(html).not.toContain("widget-secret-source");
		expect(html).not.toContain('data-type="widget"');
		expect(html).not.toContain("footer");
	});

	it("keeps broken math readable as its LaTeX source", async () => {
		const html = await renderWorkspaceDocumentPdfHtml({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "inlineMath", attrs: { latex: "\\definitelynotacommand{" } }],
				},
			],
		});

		expect(html).toContain("math-fallback");
		expect(html).toContain("$\\definitelynotacommand{$");
	});
});
