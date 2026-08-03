/**
 * Consent state for non-essential analytics. Persisted in localStorage (client
 * reads) and mirrored to a cookie so the server can gate its own collection on
 * the same choice. Strictly-necessary auth/session cookies are never gated by
 * this — only PostHog analytics and session replay.
 */

export const CONSENT_STORAGE_KEY = "thinkex_consent";

/** Same value as the storage key; mirrored here so the Worker can read the choice. */
export const CONSENT_COOKIE_NAME = CONSENT_STORAGE_KEY;

/** One year — a settled preference, not a session value. */
const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Bump when the categories or their meaning change; older records are re-prompted. */
const CONSENT_VERSION = 1;

const CONSENT_CHANGE_EVENT = "thinkex:consent-change";
const CONSENT_OPEN_EVENT = "thinkex:consent-open";

export interface ConsentCategories {
	analytics: boolean;
	sessionReplay: boolean;
}

export interface ConsentRecord extends ConsentCategories {
	version: number;
}

export const ACCEPT_ALL: ConsentCategories = { analytics: true, sessionReplay: true };
export const REJECT_ALL: ConsentCategories = { analytics: false, sessionReplay: false };

/**
 * Parses a stored/serialized consent value (from localStorage or a cookie).
 * Pure and SSR-safe so the server can reuse it. Returns null on any mismatch,
 * which re-prompts the user rather than assuming a stale/garbled choice.
 */
export function parseConsentValue(raw: string | null | undefined): ConsentRecord | null {
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
		if (
			parsed.version !== CONSENT_VERSION ||
			typeof parsed.analytics !== "boolean" ||
			typeof parsed.sessionReplay !== "boolean"
		) {
			return null;
		}

		return {
			analytics: parsed.analytics,
			// Session replay can never be on without analytics.
			sessionReplay: parsed.analytics && parsed.sessionReplay,
			version: CONSENT_VERSION,
		};
	} catch {
		return null;
	}
}

/** Returns the stored decision, or null when the user hasn't chosen yet. */
export function getStoredConsent(): ConsentRecord | null {
	if (typeof window === "undefined") {
		return null;
	}

	return parseConsentValue(window.localStorage.getItem(CONSENT_STORAGE_KEY));
}

/** True only when the user has actively consented to analytics. */
export function hasAnalyticsConsent(): boolean {
	return getStoredConsent()?.analytics === true;
}

/** Persists a decision and notifies listeners (this tab and others). */
export function setStoredConsent(categories: ConsentCategories): ConsentRecord {
	const record: ConsentRecord = {
		analytics: categories.analytics,
		sessionReplay: categories.analytics && categories.sessionReplay,
		version: CONSENT_VERSION,
	};

	if (typeof window !== "undefined") {
		const serialized = JSON.stringify(record);
		try {
			window.localStorage.setItem(CONSENT_STORAGE_KEY, serialized);
		} catch {
			// Ignore storage failures (private mode, quota) — consent just won't persist.
		}
		// Mirror to a cookie so the Worker gates server-side collection on the same
		// choice. Not HttpOnly (the client writes it); Secure only over https so it
		// still works on http://localhost during development.
		const secure = window.location.protocol === "https:" ? "; Secure" : "";
		document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
		window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: record }));
	}

	return record;
}

/** Subscribe to consent changes from this tab or another. Returns an unsubscribe fn. */
export function subscribeToConsent(callback: () => void): () => void {
	if (typeof window === "undefined") {
		return () => {};
	}

	const handleChange = () => callback();
	const handleStorage = (event: StorageEvent) => {
		if (event.key === CONSENT_STORAGE_KEY) {
			callback();
		}
	};

	window.addEventListener(CONSENT_CHANGE_EVENT, handleChange);
	window.addEventListener("storage", handleStorage);

	return () => {
		window.removeEventListener(CONSENT_CHANGE_EVENT, handleChange);
		window.removeEventListener("storage", handleStorage);
	};
}

/** Opens the "Manage cookies" dialog (e.g. from the footer link). */
export function openConsentPreferences() {
	if (typeof window === "undefined") {
		return;
	}
	window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}

export function subscribeToConsentOpen(callback: () => void): () => void {
	if (typeof window === "undefined") {
		return () => {};
	}
	window.addEventListener(CONSENT_OPEN_EVENT, callback);
	return () => window.removeEventListener(CONSENT_OPEN_EVENT, callback);
}
