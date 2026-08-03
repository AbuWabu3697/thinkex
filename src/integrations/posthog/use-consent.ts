import { useMemo, useSyncExternalStore } from "react";

import {
	decodeConsentCookieValue,
	getStoredConsentValue,
	isConsentRequired,
	parseConsentValue,
	resolveEffectiveConsent,
	subscribeToConsent,
	type ConsentRecord,
} from "#/integrations/posthog/consent";

const subscribeToRegion = () => () => {};
const getServerConsentRequired = () => true;

function useStoredConsentState() {
	const serialized = useSyncExternalStore(subscribeToConsent, getStoredConsentValue, () => null);
	const consent = useMemo(
		() => parseConsentValue(decodeConsentCookieValue(serialized)),
		[serialized],
	);
	return { consent, serialized };
}

/** Current consent decision, or null when the user hasn't chosen yet. Reactive. */
export function useConsent(): ConsentRecord | null {
	return useStoredConsentState().consent;
}

/** Stored decision with the visitor's regional default applied. */
export function useEffectiveConsent(): ConsentRecord | null {
	const { consent, serialized } = useStoredConsentState();
	const consentRequired = useSyncExternalStore(
		subscribeToRegion,
		isConsentRequired,
		getServerConsentRequired,
	);
	return resolveEffectiveConsent(consent, consentRequired, serialized !== null);
}
