import { afterEach, describe, expect, it } from "vitest";

import { assertRequiredPostHogBuildEnv } from "./build";

const POSTHOG_BUILD_ENV = [
	"CLOUDFLARE_ENV",
	"VITE_POSTHOG_PROJECT_TOKEN",
	"VITE_POSTHOG_HOST",
	"POSTHOG_API_KEY",
	"POSTHOG_PROJECT_ID",
	"VITE_POSTHOG_FEEDBACK_SURVEY_ID",
] as const;

afterEach(() => {
	for (const name of POSTHOG_BUILD_ENV) {
		delete process.env[name];
	}
});

describe("assertRequiredPostHogBuildEnv", () => {
	it("allows staging builds with no PostHog env", () => {
		process.env.CLOUDFLARE_ENV = "staging";
		expect(() => assertRequiredPostHogBuildEnv("build")).not.toThrow();
	});

	it("requires the full staging PostHog set when any staging value is present", () => {
		process.env.CLOUDFLARE_ENV = "staging";
		process.env.VITE_POSTHOG_HOST = "https://us.i.posthog.com";
		expect(() => assertRequiredPostHogBuildEnv("build")).toThrow(
			/Missing required environment variables/,
		);
	});

	it("requires production PostHog env including the survey id", () => {
		process.env.CLOUDFLARE_ENV = "production";
		expect(() => assertRequiredPostHogBuildEnv("build")).toThrow(/VITE_POSTHOG_FEEDBACK_SURVEY_ID/);
	});
});
