import { describe, expect, it } from "vitest";

import {
	readWorkspaceCapabilityProjectionPages,
	WorkspaceCapabilityPageError,
} from "#/features/workspaces/capabilities/read-pages";

describe("workspace capability projection pages", () => {
	it("returns an empty first page for empty ready projections", () => {
		expect(readWorkspaceCapabilityProjectionPages([], {})).toEqual({
			content: "",
			pages: {
				requested: "1",
				returned: [1],
				total: 1,
			},
		});
	});

	it("rejects out-of-range empty projection page requests", () => {
		expect(() => readWorkspaceCapabilityProjectionPages([], { pages: "2" })).toThrow(
			WorkspaceCapabilityPageError,
		);
	});
});
