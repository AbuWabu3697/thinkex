import { describe, expect, it } from "vitest";

import {
	getAvailableWorkspaceItemName,
	normalizeWorkspaceItemName,
} from "#/features/workspaces/defaults";

describe("workspace item names", () => {
	it("normalizes names for portable filesystem paths", () => {
		expect(normalizeWorkspaceItemName("  Notes: draft?.md.  ")).toBe("Notes- draft-.md");
		expect(normalizeWorkspaceItemName("..")).toBe("Untitled");
		expect(normalizeWorkspaceItemName("CON.txt")).toBe("_CON.txt");
	});

	it("allocates sibling names case-insensitively", () => {
		expect(
			getAvailableWorkspaceItemName({
				type: "folder",
				existingNames: ["Notes"],
				requestedName: "notes",
			}),
		).toBe("notes 2");
	});
});
