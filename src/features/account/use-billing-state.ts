import { queryOptions, useQuery } from "@tanstack/react-query";

import { getWorkspaceBillingStateFn } from "#/features/account/billing-functions";

export const billingStateQueryOptions = () =>
	queryOptions({
		queryKey: ["billing-state"],
		queryFn: () => getWorkspaceBillingStateFn(),
		// Allowances move as the user works, but not fast enough to justify
		// refetching on every focus — the server gate is the real enforcement, and
		// this only drives disclosure.
		staleTime: 60_000,
	});

/**
 * Replaces Autumn's `useCustomer`, which they deprecated in favour of their
 * backend SDK. Everything now goes through our own server functions, so the
 * secret key stays server-side and the browser never loads their SDK.
 */
export function useBillingState() {
	const { data, isLoading, isError } = useQuery(billingStateQueryOptions());

	return {
		balances: data?.balances,
		isPending: isLoading || isError,
		isPro: data?.isPro ?? false,
	};
}
