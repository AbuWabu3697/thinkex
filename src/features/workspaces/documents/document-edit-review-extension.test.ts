// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createDeletedContentWidget } from "#/features/workspaces/documents/document-edit-review-extension";
import { getTiptapDocumentSchema } from "#/features/workspaces/documents/tiptap-schema";

describe("deleted document review content", () => {
	it("renders a removed inline formula instead of a generic block label", () => {
		const beforeDocument = getTiptapDocumentSchema().nodeFromJSON({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "defined by " },
						{ type: "inlineMath", attrs: { latex: "f(n)=n^2" } },
					],
				},
			],
		});
		let formulaPosition = -1;
		beforeDocument.descendants((node, position) => {
			if (node.type.name === "inlineMath") {
				formulaPosition = position;
			}
		});

		const widget = createDeletedContentWidget(beforeDocument, formulaPosition, formulaPosition + 1);

		expect(widget.textContent).not.toContain("Removed block");
		expect(widget.querySelector(".katex")).not.toBeNull();
	});
});
