import { getRequestHeaders } from "@tanstack/react-start/server";

import {
	CONSENT_COOKIE_NAME,
	decodeConsentCookieValue,
	parseConsentValue,
	readCookieValue,
} from "#/integrations/posthog/consent";
import { isConsentRequiredCountry } from "#/integrations/posthog/consent-region";

/**
 * Whether analytics may run for this request. An explicit choice in the
 * canonical consent cookie always wins. With no choice yet, we mirror the
 * client's regional default: opt-in required in the EEA/UK (so nothing fires),
 * opt-out elsewhere (so it does). No request context (background work) reads as
 * no consent.
 */
export function hasServerAnalyticsConsent(headers?: Headers): boolean {
	let resolved = headers;

	if (!resolved) {
		try {
			resolved = getRequestHeaders();
		} catch {
			return false;
		}
	}

	const encoded = readCookieValue(resolved.get("cookie"), CONSENT_COOKIE_NAME);
	if (encoded !== null) {
		const decoded = decodeConsentCookieValue(encoded);
		// A present but malformed or stale choice is not equivalent to no choice.
		// Fail closed rather than throwing or applying the regional opt-out default.
		return decoded ? parseConsentValue(decoded)?.analytics === true : false;
	}

	if (resolved.get("sec-gpc") === "1") {
		return false;
	}

	// No explicit choice: allowed only outside the opt-in-required region.
	return !isConsentRequiredCountry(resolved.get("cf-ipcountry"));
}
