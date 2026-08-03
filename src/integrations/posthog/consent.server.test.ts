import { describe, expect, it } from "vitest";

import { hasServerAnalyticsConsent } from "#/integrations/posthog/consent.server";

function consentCookie(analytics: boolean, sessionReplay = analytics) {
	return `thinkex_consent=${encodeURIComponent(
		JSON.stringify({ analytics, sessionReplay, version: 1 }),
	)}`;
}

describe("hasServerAnalyticsConsent", () => {
	it("uses the regional default when no explicit choice exists", () => {
		expect(hasServerAnalyticsConsent(new Headers({ "cf-ipcountry": "US" }))).toBe(true);
		expect(hasServerAnalyticsConsent(new Headers({ "cf-ipcountry": "DE" }))).toBe(false);
	});

	it("lets an explicit choice override the regional default", () => {
		expect(
			hasServerAnalyticsConsent(
				new Headers({ cookie: consentCookie(false), "cf-ipcountry": "US" }),
			),
		).toBe(false);
		expect(
			hasServerAnalyticsConsent(new Headers({ cookie: consentCookie(true), "cf-ipcountry": "DE" })),
		).toBe(true);
	});

	it("fails closed for invalid explicit choices", () => {
		const stale = encodeURIComponent(JSON.stringify({ analytics: true, version: 0 }));

		for (const cookie of ["thinkex_consent=%E0%A4%A", `thinkex_consent=${stale}`]) {
			expect(hasServerAnalyticsConsent(new Headers({ cookie, "cf-ipcountry": "US" }))).toBe(false);
		}
	});
});
