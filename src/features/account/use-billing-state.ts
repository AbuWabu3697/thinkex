import { useQuery } from "@tanstack/react-query";

import { getWorkspaceBillingStateFn } from "#/features/account/billing-functions";

export const BILLING_STATE_QUERY_KEY = ["billing-state"] as const;

/**
 * Replaces Autumn's `useCustomer`, which they deprecated in favour of their
 * backend SDK. Everything now goes through our own server functions, so the
 * secret key stays server-side and the browser never loads their SDK.
 */
export function useBillingState() {
	const { data, isLoading, isError } = useQuery({
		queryKey: BILLING_STATE_QUERY_KEY,
		queryFn: () => getWorkspaceBillingStateFn(),
		// Allowances move as the user works, but not fast enough to justify
		// refetching on every focus — the server gate is the real enforcement, and
		// this only drives disclosure.
		staleTime: 60_000,
	});

	return {
		balances: data?.balances,
		isPending: isLoading || isError,
		isPro: data?.isPro ?? false,
	};
}
