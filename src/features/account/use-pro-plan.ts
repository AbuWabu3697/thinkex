import { useBillingState } from "#/features/account/use-billing-state";

export const PRO_PLAN_ID = "pro";

/**
 * Whether Pro is active right now. Lives on its own because three surfaces need
 * it — the plan panel, the model picker, the composer notice — and every one of
 * them uses it to decide whether an upgrade prompt is honest. A prompt shown to
 * someone who already pays reads as the product not knowing who they are.
 *
 * False while loading, so an upgrade CTA can never flash at a subscriber.
 */
export function useIsProPlan() {
	return useBillingState().isPro;
}
