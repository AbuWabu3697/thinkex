import { getRequestHeaders } from "@tanstack/react-start/server";

import { CONSENT_COOKIE_NAME, parseConsentValue } from "#/integrations/posthog/consent";

/**
 * True only when the request carries an explicit analytics-consent cookie (the
 * choice the browser mirrored from localStorage). No cookie, no request context
 * (background work), or an unparseable value all read as no consent — so nothing
 * non-essential fires unless the user opted in.
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

	return (
		parseConsentValue(readCookie(resolved.get("cookie"), CONSENT_COOKIE_NAME))?.analytics === true
	);
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
