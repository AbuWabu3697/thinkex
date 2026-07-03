import {
	getWorkspaceCapabilityPageContext,
	resolveWorkspaceCapabilityExistingItemPath,
} from "#/features/workspaces/capabilities/common";
import type { WorkspaceCapabilityContext } from "#/features/workspaces/capabilities/workspace-capability-context";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import {
	getParentWorkspacePath,
	joinWorkspaceItemPath,
} from "#/features/workspaces/kernel/workspace-kernel-paths";
import { WorkspaceKernelNameConflictError } from "#/features/workspaces/kernel/workspace-kernel-store";

export interface RenameWorkspaceCapabilityItemInput {
	name: string;
	path: string;
}

export const renameWorkspaceCapabilityFailureCodes = [
	"cannot_rename_root",
	"path_already_exists",
	"path_not_absolute",
	"path_not_found",
] as const;

export interface RenameWorkspaceCapabilityFailure {
	code: (typeof renameWorkspaceCapabilityFailureCodes)[number];
	path: string;
}

export interface RenameWorkspaceCapabilityRenamedItem {
	path: string;
	previousPath: string;
	type: WorkspaceItemSummary["type"];
}

export interface RenameWorkspaceCapabilityItemResult {
	failed: RenameWorkspaceCapabilityFailure[];
	item?: RenameWorkspaceCapabilityRenamedItem;
}

export async function renameWorkspaceCapabilityItem(
	capabilityContext: WorkspaceCapabilityContext,
	input: RenameWorkspaceCapabilityItemInput,
): Promise<RenameWorkspaceCapabilityItemResult> {
	const workspaceContext = await getWorkspaceCapabilityPageContext({
		access: "mutate",
		context: capabilityContext,
	});
	const resolution = resolveWorkspaceCapabilityExistingItemPath({
		path: input.path,
		rootFailureCode: "cannot_rename_root",
		tree: workspaceContext.tree,
	});

	if (resolution.status === "failed") {
		return {
			failed: [
				{
					code: resolution.failure.code,
					path: resolution.failure.path,
				},
			],
		};
	}

	try {
		const command = await workspaceContext.kernel.renameItem({
			itemId: resolution.item.id,
			name: input.name,
			onNameConflict: "error",
			actorUserId: capabilityContext.actor.userId,
			clientMutationId: null,
		});

		return {
			failed: [],
			item: {
				path: joinWorkspaceItemPath(getParentWorkspacePath(resolution.path), command.result.name),
				previousPath: resolution.path,
				type: command.result.type,
			},
		};
	} catch (error) {
		if (error instanceof WorkspaceKernelNameConflictError) {
			return {
				failed: [
					{
						code: "path_already_exists",
						path: resolution.path,
					},
				],
			};
		}

		throw error;
	}
}
