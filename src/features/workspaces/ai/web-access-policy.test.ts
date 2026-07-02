import { describe, expect, it } from "vitest";

import { assertPublicHttpUrl } from "#/features/workspaces/ai/web-access-policy";

describe("web access policy", () => {
	it("accepts public HTTP URLs and strips fragments", () => {
		const url = assertPublicHttpUrl("https://Example.com/docs?q=search#private");

		expect(url.toString()).toBe("https://example.com/docs?q=search");
	});

	it("rejects local, credentialed, and non-HTTP URLs", () => {
		expect(() => assertPublicHttpUrl("http://localhost:3000")).toThrow(
			"Only public domain-name URLs are supported.",
		);
		expect(() => assertPublicHttpUrl("https://user:pass@example.com")).toThrow(
			"URLs with embedded credentials are not allowed.",
		);
		expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow(
			"Only http: and https: URLs are supported.",
		);
		expect(() => assertPublicHttpUrl("https://127.0.0.1")).toThrow(
			"Only public domain-name URLs are supported.",
		);
	});
});
