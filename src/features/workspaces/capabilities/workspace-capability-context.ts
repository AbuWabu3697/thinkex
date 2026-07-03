import {
	assertCapabilityScope,
	type CapabilityActor,
	createCapabilityActor,
	type ScopedCapabilityContext,
} from "#/features/workspaces/capabilities/capability-context";

export const workspaceCapabilityScopes = ["workspace:read", "workspace:write"] as const;

export type WorkspaceCapabilityScope = (typeof workspaceCapabilityScopes)[number];

export type WorkspaceCapabilityActor = CapabilityActor<WorkspaceCapabilityScope>;

export interface WorkspaceCapabilityContext extends ScopedCapabilityContext<WorkspaceCapabilityScope> {
	workspaceId: string;
}

export function createWorkspaceCapabilityContext(input: {
	scopes: readonly WorkspaceCapabilityScope[];
	userId: string;
	workspaceId: string;
}): WorkspaceCapabilityContext {
	return {
		actor: createCapabilityActor(input),
		workspaceId: input.workspaceId,
	};
}

export function assertWorkspaceCapabilityScope(
	context: WorkspaceCapabilityContext,
	scope: WorkspaceCapabilityScope,
) {
	assertCapabilityScope(context, "workspace", scope);
}
