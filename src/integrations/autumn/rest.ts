/**
 * Autumn over plain HTTP, in place of the SDK.
 *
 * The SDK ships ~24MB of JavaScript and builds over a thousand Zod schemas as it
 * evaluates, which is enough on its own to blow Cloudflare's Worker startup CPU
 * limit and have the deploy rejected. We call six endpoints; a typed fetch is a
 * fraction of the weight and none of the startup cost.
 *
 * The wire format is snake_case in both directions. Converting it would mean
 * re-deriving every response shape, so the types below mirror the wire exactly
 * and callers read snake_case fields.
 */
const AUTUMN_API_BASE_URL = "https://api.useautumn.com/v1";

export interface AutumnBalance {
	feature_id: string;
	granted: number;
	remaining: number;
	usage: number;
	unlimited: boolean;
	next_reset_at: number | null;
}

export interface AutumnSubscription {
	plan_id: string;
	status: string;
	add_on: boolean;
}

export interface AutumnCustomer {
	id: string;
	balances: Record<string, AutumnBalance | undefined>;
	subscriptions: AutumnSubscription[];
}

export interface AutumnCheckResult {
	allowed: boolean;
	balance: AutumnBalance | null;
}

export class AutumnRequestError extends Error {
	readonly status: number;

	constructor(path: string, status: number, body: string) {
		super(`Autumn ${path} failed with ${status}: ${body.slice(0, 200)}`);
		this.name = "AutumnRequestError";
		this.status = status;
	}
}

async function autumnRequest<TResult>(input: {
	body: Record<string, unknown>;
	path: string;
	secretKey: string;
}): Promise<TResult> {
	const response = await fetch(`${AUTUMN_API_BASE_URL}/${input.path}`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${input.secretKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(input.body),
	});

	if (!response.ok) {
		throw new AutumnRequestError(input.path, response.status, await response.text());
	}

	return (await response.json()) as TResult;
}

export function checkAutumnBalance(input: {
	customerId: string;
	featureId: string;
	secretKey: string;
}) {
	return autumnRequest<AutumnCheckResult>({
		body: { customer_id: input.customerId, feature_id: input.featureId },
		path: "balances.check",
		secretKey: input.secretKey,
	});
}

/**
 * `value` defaults to one because every meter here counts events, not units — a
 * message is a message whatever model answered it.
 */
export function trackAutumnBalance(input: {
	customerId: string;
	featureId: string;
	properties?: Record<string, unknown>;
	secretKey: string;
}) {
	return autumnRequest<unknown>({
		body: {
			customer_id: input.customerId,
			feature_id: input.featureId,
			properties: input.properties,
			value: 1,
		},
		path: "balances.track",
		secretKey: input.secretKey,
	});
}

export function getOrCreateAutumnCustomer(input: {
	customerId: string;
	email?: string;
	metadata?: Record<string, unknown>;
	name?: string;
	secretKey: string;
}) {
	return autumnRequest<AutumnCustomer>({
		body: {
			customer_id: input.customerId,
			email: input.email,
			metadata: input.metadata,
			name: input.name,
		},
		path: "customers.get_or_create",
		secretKey: input.secretKey,
	});
}

export function getAutumnCustomer(input: { customerId: string; secretKey: string }) {
	return autumnRequest<AutumnCustomer>({
		body: { customer_id: input.customerId },
		path: "customers.get",
		secretKey: input.secretKey,
	});
}

/** Null when the plan needs no payment, which is why callers must handle both. */
export function attachAutumnPlan(input: {
	customerId: string;
	planId: string;
	secretKey: string;
	successUrl?: string;
}) {
	return autumnRequest<{ payment_url: string | null }>({
		body: {
			customer_id: input.customerId,
			plan_id: input.planId,
			success_url: input.successUrl,
		},
		path: "billing.attach",
		secretKey: input.secretKey,
	});
}

export function openAutumnCustomerPortal(input: {
	customerId: string;
	returnUrl?: string;
	secretKey: string;
}) {
	return autumnRequest<{ url: string }>({
		body: { customer_id: input.customerId, return_url: input.returnUrl },
		path: "billing.open_customer_portal",
		secretKey: input.secretKey,
	});
}
