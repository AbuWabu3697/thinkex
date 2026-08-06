import posthog from "posthog-js";

import { isPostHogEnabled, isPostHogSessionReplayEnabled } from "#/integrations/posthog/config";
import type { ConsentRecord } from "#/integrations/posthog/consent";

/**
 * Reconciles PostHog's capturing state with the user's consent. PostHog starts
 * opted out (`opt_out_capturing_by_default`), so nothing is captured until this
 * runs with an analytics-consenting record. Session replay is a sub-toggle of
 * analytics: it can only record while capturing is on.
 */
export function applyConsentToPostHog(consent: ConsentRecord | null) {
	if (!isPostHogEnabled) {
		return;
	}

	if (consent?.analytics) {
		posthog.opt_in_capturing();
	} else {
		posthog.opt_out_capturing();
	}

	if (consent?.analytics && consent.sessionReplay && isPostHogSessionReplayEnabled) {
		posthog.startSessionRecording();
	} else {
		posthog.stopSessionRecording();
	}
}
