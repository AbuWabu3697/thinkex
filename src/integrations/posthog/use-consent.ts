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
	const serialized = useSyncExternalStore<string | null | undefined>(
		subscribeToConsent,
		getStoredConsentValue,
		() => undefined,
	);
	const consent = useMemo(
		() =>
			serialized === undefined
				? undefined
				: parseConsentValue(decodeConsentCookieValue(serialized)),
		[serialized],
	);
	return { consent, serialized };
}

/** Current consent decision, null when unchosen, or undefined while hydrating. Reactive. */
export function useConsent(): ConsentRecord | null | undefined {
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
	return resolveEffectiveConsent(consent ?? null, consentRequired, serialized !== null);
}
