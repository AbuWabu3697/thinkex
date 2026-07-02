export const workspaceCapabilityScopes = ["workspace:read", "workspace:write"] as const;

export type WorkspaceCapabilityScope = (typeof workspaceCapabilityScopes)[number];

export interface WorkspaceCapabilityActor {
	scopes: ReadonlySet<WorkspaceCapabilityScope>;
	userId: string;
}

export interface WorkspaceCapabilityContext {
	actor: WorkspaceCapabilityActor;
	workspaceId: string;
}

export class WorkspaceCapabilityScopeError extends Error {
	constructor(scope: WorkspaceCapabilityScope) {
		super(`Missing workspace capability scope: ${scope}`);
		this.name = "WorkspaceCapabilityScopeError";
	}
}

export function createWorkspaceCapabilityContext(input: {
	scopes: readonly WorkspaceCapabilityScope[];
	userId: string;
	workspaceId: string;
}): WorkspaceCapabilityContext {
	return {
		actor: {
			scopes: new Set(input.scopes),
			userId: input.userId,
		},
		workspaceId: input.workspaceId,
	};
}

export function assertWorkspaceCapabilityScope(
	context: WorkspaceCapabilityContext,
	scope: WorkspaceCapabilityScope,
) {
	if (!context.actor.scopes.has(scope)) {
		throw new WorkspaceCapabilityScopeError(scope);
	}
}
