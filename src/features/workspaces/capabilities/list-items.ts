import { getWorkspaceCapabilityPageContext } from "#/features/workspaces/capabilities/common";
import type { WorkspaceCapabilityContext } from "#/features/workspaces/capabilities/workspace-capability-context";
import {
	listWorkspaceKernelTreeItems,
	type ListWorkspaceKernelItemsResult,
} from "#/features/workspaces/kernel/workspace-kernel-list";

export interface ListWorkspaceCapabilityItemsInput {
	limit?: number;
	path?: string;
	recursive?: boolean;
}

export async function listWorkspaceCapabilityItems(
	capabilityContext: WorkspaceCapabilityContext,
	input: ListWorkspaceCapabilityItemsInput,
): Promise<ListWorkspaceKernelItemsResult> {
	const workspaceContext = await getWorkspaceCapabilityPageContext({
		access: "read",
		context: capabilityContext,
	});

	return listWorkspaceKernelTreeItems({
		tree: workspaceContext.tree,
		path: input.path,
		recursive: input.recursive,
		limit: input.limit,
	});
}
