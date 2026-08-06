import { useQuery } from "@tanstack/react-query";

import { getWorkspaceBillingStateFn } from "#/features/account/billing-functions";

export const BILLING_STATE_QUERY_KEY = ["billing-state"] as const;

/**
 * Replaces Autumn's `useCustomer`, which they deprecated in favour of their
 * backend SDK. Everything now goes through our own server functions, so the
 * secret key stays server-side and the browser never loads their SDK.
 *
 * `exact` is for the places that print a number. The composer only says which
 * side of a limit you're on, and is wrong for a few seconds at worst; the plan
 * panel says "412 of 500" and being wrong there is the whole complaint. So the
 * panel refetches whenever it opens, and everything else shares the result.
 */
export function useBillingState({ exact = false } = {}) {
	const { data, isLoading, isError } = useQuery({
		queryKey: BILLING_STATE_QUERY_KEY,
		queryFn: () => getWorkspaceBillingStateFn(),
		// Long enough that alt-tabbing around a chat doesn't refetch constantly.
		// The server gate is the real enforcement; this only drives disclosure.
		staleTime: 60_000,
		refetchOnMount: exact ? "always" : true,
	});

	return {
		balances: data?.balances,
		isPending: isLoading || isError,
		isPro: data?.isPro ?? false,
	};
}
