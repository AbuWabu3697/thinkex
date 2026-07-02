import { describe, expect, it } from "vitest";

import { fileMatchesAccept } from "#/lib/file-accept";

describe("file accept matching", () => {
	it("accepts any file when no accept list is configured", () => {
		expect(
			fileMatchesAccept(new File(["hello"], "notes.txt", { type: "text/plain" }), undefined),
		).toBe(true);
		expect(fileMatchesAccept(new File(["hello"], "notes.txt", { type: "text/plain" }), "   ")).toBe(
			true,
		);
	});

	it("matches extensions case-insensitively", () => {
		expect(
			fileMatchesAccept(new File([""], "Report.PDF", { type: "application/pdf" }), ".pdf"),
		).toBe(true);
		expect(fileMatchesAccept(new File([""], "report.docx", { type: "" }), ".pdf,.docx")).toBe(true);
		expect(fileMatchesAccept(new File([""], "report.txt", { type: "text/plain" }), ".pdf")).toBe(
			false,
		);
	});

	it("matches exact MIME types and wildcard MIME families", () => {
		expect(fileMatchesAccept(new File([""], "photo.jpg", { type: "image/jpeg" }), "image/*")).toBe(
			true,
		);
		expect(
			fileMatchesAccept(new File(["{}"], "data.json", { type: "application/json" }), "text/*"),
		).toBe(false);
		expect(
			fileMatchesAccept(
				new File(["{}"], "data.json", { type: "application/json" }),
				"application/json",
			),
		).toBe(true);
	});
});
