import {
	assertCapabilityScope,
	type CapabilityActor,
	createCapabilityActor,
	type ScopedCapabilityContext,
} from "#/features/workspaces/capabilities/capability-context";

export const accountCapabilityScopes = ["workspaces:read"] as const;

export type AccountCapabilityScope = (typeof accountCapabilityScopes)[number];

export type AccountCapabilityActor = CapabilityActor<AccountCapabilityScope>;

export type AccountCapabilityContext = ScopedCapabilityContext<AccountCapabilityScope>;

export function createAccountCapabilityContext(input: {
	scopes: readonly AccountCapabilityScope[];
	userId: string;
}): AccountCapabilityContext {
	return {
		actor: createCapabilityActor(input),
	};
}

export function assertAccountCapabilityScope(
	context: AccountCapabilityContext,
	scope: AccountCapabilityScope,
) {
	assertCapabilityScope(context, "account", scope);
}
