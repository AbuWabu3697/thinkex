/**
 * Region logic for consent defaults. In the EEA and UK, non-essential analytics
 * are unlawful without prior opt-in, so they stay off until the user accepts.
 * Elsewhere (e.g. the US, an opt-out regime), analytics are on by default with a
 * notice and an easy opt-out. Switzerland is included for its equivalent FADP.
 *
 * Pure and dependency-free so both the Worker (from cf-ipcountry) and the browser
 * (from the mirrored cookie) can share it.
 */

/** Cookie the Worker stamps on HTML responses so the client knows the visitor's region. */
export const CONSENT_REQUIRED_COOKIE = "thinkex_consent_required";

// EEA (EU-27 + Iceland, Liechtenstein, Norway) + United Kingdom + Switzerland.
const CONSENT_REQUIRED_COUNTRIES = new Set([
	"AT",
	"BE",
	"BG",
	"HR",
	"CY",
	"CZ",
	"DK",
	"EE",
	"FI",
	"FR",
	"DE",
	"GR",
	"HU",
	"IE",
	"IT",
	"LV",
	"LT",
	"LU",
	"MT",
	"NL",
	"PL",
	"PT",
	"RO",
	"SK",
	"SI",
	"ES",
	"SE",
	"IS",
	"LI",
	"NO",
	"GB",
	"CH",
]);

/**
 * Whether prior opt-in is required for this country. Unknown or missing region
 * (dev, Tor, `cf-ipcountry` absent) errs toward required — the privacy-safe default.
 */
export function isConsentRequiredCountry(country: string | null | undefined): boolean {
	if (!country) {
		return true;
	}

	const normalized = country.trim().toUpperCase();
	// Cloudflare uses "XX"/"T1" for unknown/Tor; treat those as required.
	if (!normalized || normalized === "XX" || normalized === "T1") {
		return true;
	}

	return CONSENT_REQUIRED_COUNTRIES.has(normalized);
}
