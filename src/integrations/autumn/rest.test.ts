import { afterEach, describe, expect, it, vi } from "vitest";

import { checkAutumnBalance } from "#/integrations/autumn/rest";

const CHECK_INPUT = {
	customerId: "existing_thinkex_user",
	featureId: "file_uploads",
	secretKey: "am_sk_live_test",
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("checkAutumnBalance", () => {
	it("creates a missing Autumn customer and retries once", async () => {
		const paths: string[] = [];
		const responses = [
			new Response(JSON.stringify({ code: "customer_not_found" }), { status: 404 }),
			new Response(JSON.stringify({ id: CHECK_INPUT.customerId })),
			new Response(JSON.stringify({ allowed: true, balance: null })),
		];
		vi.stubGlobal("fetch", async (url: string) => {
			paths.push(new URL(url).pathname.split("/").at(-1) ?? "");
			return responses.shift();
		});

		await expect(checkAutumnBalance(CHECK_INPUT)).resolves.toEqual({
			allowed: true,
			balance: null,
		});
		expect(paths).toEqual(["balances.check", "customers.get_or_create", "balances.check"]);
	});
});
