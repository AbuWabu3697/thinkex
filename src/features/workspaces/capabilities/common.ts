import { createDbContext } from "#/db/server";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import {
	getWorkspaceKernel,
	type WorkspaceKernelClient,
} from "#/features/workspaces/kernel/workspace-kernel-access";
import {
	buildWorkspaceKernelTree,
	normalizeWorkspacePath,
	resolveWorkspaceKernelItemPath,
	WorkspaceKernelPathError,
	type WorkspaceKernelTree,
} from "#/features/workspaces/kernel/workspace-kernel-paths";
import {
	assertCanMutateWorkspace,
	assertCanReadWorkspace,
} from "#/features/workspaces/server/permissions";
import {
	assertWorkspaceCapabilityScope,
	type WorkspaceCapabilityContext,
} from "#/features/workspaces/capabilities/workspace-capability-context";

export type WorkspaceCapabilityAccessMode = "read" | "mutate";

export interface WorkspaceCapabilityPageContext {
	kernel: WorkspaceKernelClient;
	pageItems: WorkspaceItemSummary[];
	tree: WorkspaceKernelTree;
}

export type WorkspaceCapabilityPathResolution =
	| {
			code: "path_not_absolute";
			path: string;
			status: "invalid_path";
	  }
	| {
			path: string;
			status: "not_found";
	  }
	| {
			path: string;
			status: "root";
	  }
	| {
			item: WorkspaceItemSummary;
			path: string;
			status: "item";
	  };

export type WorkspaceCapabilityExistingItemResolution<TRootCode extends string> =
	| {
			failure: {
				code: "path_not_absolute" | "path_not_found" | TRootCode;
				path: string;
			};
			status: "failed";
	  }
	| {
			item: WorkspaceItemSummary;
			path: string;
			status: "item";
	  };

export async function getWorkspaceCapabilityPageContext(input: {
	access: WorkspaceCapabilityAccessMode;
	context: WorkspaceCapabilityContext;
}): Promise<WorkspaceCapabilityPageContext> {
	const dbContext = await createDbContext();
	const workspaceUser = {
		userId: input.context.actor.userId,
		workspaceId: input.context.workspaceId,
	};

	try {
		if (input.access === "read") {
			assertWorkspaceCapabilityScope(input.context, "workspace:read");
			await assertCanReadWorkspace(dbContext.db, workspaceUser);
		} else {
			assertWorkspaceCapabilityScope(input.context, "workspace:write");
			await assertCanMutateWorkspace(dbContext.db, workspaceUser);
		}

		const kernel = await getWorkspaceKernel(input.context.workspaceId);
		const page = await kernel.getPage();

		return {
			kernel,
			pageItems: page.items,
			tree: buildWorkspaceKernelTree(page.items),
		};
	} finally {
		await dbContext.dispose();
	}
}

export function resolveWorkspaceCapabilityPath(input: {
	path: string;
	tree: WorkspaceKernelTree;
}): WorkspaceCapabilityPathResolution {
	try {
		const normalizedPath = normalizeWorkspacePath(input.path);

		if (normalizedPath === "/") {
			return {
				path: normalizedPath,
				status: "root",
			};
		}

		const item = resolveWorkspaceKernelItemPath(normalizedPath, input.tree);

		if (!item) {
			return {
				path: normalizedPath,
				status: "not_found",
			};
		}

		return {
			item,
			path: normalizedPath,
			status: "item",
		};
	} catch (error) {
		if (error instanceof WorkspaceKernelPathError && error.code === "path_not_absolute") {
			return {
				code: error.code,
				path: input.path,
				status: "invalid_path",
			};
		}

		throw error;
	}
}

export function resolveWorkspaceCapabilityExistingItemPath<TRootCode extends string>(input: {
	path: string;
	rootFailureCode: TRootCode;
	tree: WorkspaceKernelTree;
}): WorkspaceCapabilityExistingItemResolution<TRootCode> {
	const resolution = resolveWorkspaceCapabilityPath(input);

	if (resolution.status === "invalid_path") {
		return {
			failure: {
				code: resolution.code,
				path: resolution.path,
			},
			status: "failed",
		};
	}

	if (resolution.status === "root") {
		return {
			failure: {
				code: input.rootFailureCode,
				path: resolution.path,
			},
			status: "failed",
		};
	}

	if (resolution.status === "not_found") {
		return {
			failure: {
				code: "path_not_found",
				path: resolution.path,
			},
			status: "failed",
		};
	}

	return resolution;
}
