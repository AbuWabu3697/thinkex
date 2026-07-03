export interface CapabilityActor<TScope extends string> {
	scopes: ReadonlySet<TScope>;
	userId: string;
}

export interface ScopedCapabilityContext<TScope extends string> {
	actor: CapabilityActor<TScope>;
}

export class CapabilityScopeError<TScope extends string> extends Error {
	constructor(
		readonly domain: string,
		readonly scope: TScope,
	) {
		super(`Missing ${domain} capability scope: ${scope}`);
		this.name = "CapabilityScopeError";
	}
}

export function createCapabilityActor<TScope extends string>(input: {
	scopes: readonly TScope[];
	userId: string;
}): CapabilityActor<TScope> {
	return {
		scopes: new Set(input.scopes),
		userId: input.userId,
	};
}

export function assertCapabilityScope<TScope extends string>(
	context: ScopedCapabilityContext<TScope>,
	domain: string,
	scope: TScope,
) {
	if (!context.actor.scopes.has(scope)) {
		throw new CapabilityScopeError(domain, scope);
	}
}
