import { eq } from "drizzle-orm";

import { user } from "#/db/schema";
import { createDbContext } from "#/db/server";
import { resolveAutumnSecretKey } from "#/integrations/autumn/secret-key";
import {
	logOperationalEvent,
	recordOperationalFailure,
} from "#/integrations/observability/operational-events";

export interface AutumnCustomerFields {
	email?: string;
	metadata: {
		account_type?: "anonymous" | "registered";
		email_verified?: boolean;
		source: "thinkex";
		user_created_at?: string;
	};
	name?: string;
}

const DEFAULT_AUTUMN_CUSTOMER_FIELDS = {
	metadata: {
		source: "thinkex",
	},
} as const satisfies AutumnCustomerFields;

/**
 * Imported on demand, never at module scope. The SDK builds well over a thousand
 * Zod schemas while it evaluates, and a static import puts all of that in the
 * Worker's startup path — enough on its own to fail Cloudflare's startup CPU
 * limit and reject the deploy. Behind a dynamic import the cost moves to the
 * first request that actually bills something.
 *
 * Null when no key resolves, which callers treat as "skip tracking".
 */
export async function getAutumnClient(env: Cloudflare.Env) {
	const secretKey = resolveAutumnSecretKey(env);

	if (!secretKey) {
		return null;
	}

	const { Autumn } = await import("autumn-js");

	return new Autumn({
		secretKey,
	});
}

export async function getAutumnCustomerFields(userId: string): Promise<AutumnCustomerFields> {
	let dbContext: Awaited<ReturnType<typeof createDbContext>> | undefined;

	try {
		dbContext = await createDbContext();

		const [row] = await dbContext.db
			.select({
				createdAt: user.createdAt,
				email: user.email,
				emailVerified: user.emailVerified,
				isAnonymous: user.isAnonymous,
				name: user.name,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (!row) {
			return DEFAULT_AUTUMN_CUSTOMER_FIELDS;
		}

		const isAnonymous = Boolean(row.isAnonymous);

		return {
			...(isAnonymous ? {} : getNamedCustomerFields(row)),
			metadata: {
				...DEFAULT_AUTUMN_CUSTOMER_FIELDS.metadata,
				account_type: isAnonymous ? "anonymous" : "registered",
				email_verified: row.emailVerified,
				user_created_at: row.createdAt.toISOString(),
			},
		};
	} catch (error) {
		recordOperationalFailure({
			distinctId: userId,
			error,
			event: "autumn_customer_fields",
		});

		return DEFAULT_AUTUMN_CUSTOMER_FIELDS;
	} finally {
		await dbContext?.dispose();
	}
}

function getNamedCustomerFields(row: { email: string; name: string }) {
	return {
		email: row.email.trim() || undefined,
		name: row.name.trim() || undefined,
	};
}

export interface TrackAutumnUsageInput {
	env: Cloudflare.Env;
	/** Operational event name, used for both the partial log and the failure. */
	event: string;
	featureId: string;
	/** Sent to Autumn, and mirrored into the operational log. */
	properties: Record<string, boolean | number | string | null>;
	userId: string;
}

/**
 * Ensures the customer exists, then records one unit of usage. Shared because
 * the getOrCreate / track / partial-response / failure handling is identical for
 * every metered feature — only the feature id and properties differ.
 */
export async function trackAutumnUsage(input: TrackAutumnUsageInput) {
	const autumn = await getAutumnClient(input.env);

	if (!autumn) {
		return;
	}

	const fields = { ...input.properties, feature_id: input.featureId, user_id: input.userId };

	try {
		const customerFields = await getAutumnCustomerFields(input.userId);

		await autumn.customers.getOrCreate({ customerId: input.userId, ...customerFields });

		try {
			await autumn.track({
				customerId: input.userId,
				featureId: input.featureId,
				value: 1,
				properties: input.properties,
				async: true,
			});
		} catch (error) {
			// Free by now: getAutumnClient already evaluated the module, so this
			// resolves from cache rather than paying the import a second time.
			const { ResponseValidationError } = await import("autumn-js");

			if (!(error instanceof ResponseValidationError)) {
				throw error;
			}

			// Autumn can accept an async usage event but return a slim response that
			// fails the SDK's success schema. Keep that visible without escalating it.
			logOperationalEvent({
				event: input.event,
				fields: { ...fields, error_type: error.name, operation_stage: "track_response" },
				outcome: "partial",
			});
		}
	} catch (error) {
		recordOperationalFailure({ distinctId: input.userId, error, event: input.event, fields });
	}
}
