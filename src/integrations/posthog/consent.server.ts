import { getRequestHeaders } from "@tanstack/react-start/server";

import { CONSENT_COOKIE_NAME, parseConsentValue } from "#/integrations/posthog/consent";
import { isConsentRequiredCountry } from "#/integrations/posthog/consent-region";

/**
 * Whether analytics may run for this request. An explicit choice (the cookie the
 * browser mirrored from localStorage) always wins. With no choice yet, we mirror
 * the client's regional default: opt-in required in the EEA/UK (so nothing
 * fires), opt-out elsewhere (so it does). No request context (background work)
 * reads as no consent.
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

	const stored = parseConsentValue(readCookie(resolved.get("cookie"), CONSENT_COOKIE_NAME));
	if (stored) {
		return stored.analytics;
	}

	// No explicit choice: allowed only outside the opt-in-required region.
	return !isConsentRequiredCountry(resolved.get("cf-ipcountry"));
}

function readCookie(cookieHeader: string | null, name: string): string | null {
	if (!cookieHeader) {
		return null;
	}

	for (const part of cookieHeader.split(";")) {
		const separator = part.indexOf("=");
		if (separator === -1) {
			continue;
		}
		if (part.slice(0, separator).trim() === name) {
			return decodeURIComponent(part.slice(separator + 1).trim());
		}
	}

	return null;
}
