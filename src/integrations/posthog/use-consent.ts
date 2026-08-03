import { useSyncExternalStore } from "react";

import {
	getStoredConsent,
	subscribeToConsent,
	type ConsentRecord,
} from "#/integrations/posthog/consent";

/** Current consent decision, or null when the user hasn't chosen yet. Reactive. */
export function useConsent(): ConsentRecord | null {
	return useSyncExternalStore(subscribeToConsent, getStoredConsent, () => null);
}
