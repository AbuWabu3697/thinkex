import type { z } from "zod";

import { createWorkspaceCapabilityItems } from "#/features/workspaces/capabilities/create-items";
import { deleteWorkspaceCapabilityItems } from "#/features/workspaces/capabilities/delete-items";
import { editWorkspaceCapabilityItem } from "#/features/workspaces/capabilities/edit-item";
import { listWorkspaceCapabilityItems } from "#/features/workspaces/capabilities/list-items";
import { moveWorkspaceCapabilityItems } from "#/features/workspaces/capabilities/move-items";
import { readWorkspaceCapabilityItems } from "#/features/workspaces/capabilities/read-items";
import { renameWorkspaceCapabilityItem } from "#/features/workspaces/capabilities/rename-item";
import {
	workspaceCreateItemsInputExamples,
	workspaceCreateItemsInputSchema,
	workspaceCreateItemsOutputSchema,
	workspaceDeleteItemsInputExamples,
	workspaceDeleteItemsInputSchema,
	workspaceDeleteItemsOutputSchema,
	workspaceDocumentMarkdownMathInstruction,
	workspaceEditItemInputExamples,
	workspaceEditItemInputSchema,
	workspaceEditItemOutputSchema,
	workspaceListItemsInputExamples,
	workspaceListItemsInputSchema,
	workspaceListItemsOutputSchema,
	workspaceMoveItemsInputExamples,
	workspaceMoveItemsInputSchema,
	workspaceMoveItemsOutputSchema,
	workspaceReadItemsInputExamples,
	workspaceReadItemsInputSchema,
	workspaceReadItemsOutputSchema,
	workspaceRenameItemInputExamples,
	workspaceRenameItemInputSchema,
	workspaceRenameItemOutputSchema,
} from "#/features/workspaces/capabilities/tool-schemas";
import type {
	WorkspaceCapabilityContext,
	WorkspaceCapabilityScope,
} from "#/features/workspaces/capabilities/workspace-capability-context";
import { workspaceCapabilityScopes } from "#/features/workspaces/capabilities/workspace-capability-context";

const workspaceReadCapabilityScopes = [
	"workspace:read",
] as const satisfies readonly WorkspaceCapabilityScope[];
const workspaceMutateCapabilityScopes = workspaceCapabilityScopes;

export type WorkspaceCapabilityToolDefinition<
	TName extends string = string,
	TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
	TOutputSchema extends z.ZodTypeAny = z.ZodTypeAny,
> = {
	description: string;
	execute: (
		args: z.output<TInputSchema>,
		context: WorkspaceCapabilityContext,
	) => Promise<z.output<TOutputSchema>>;
	inputExamples: Array<{ input: z.input<TInputSchema> }>;
	inputSchema: TInputSchema;
	mutating: boolean;
	name: TName;
	outputSchema: TOutputSchema;
	scopes: readonly WorkspaceCapabilityScope[];
};

function defineWorkspaceCapabilityTool<
	TName extends string,
	TInputSchema extends z.ZodTypeAny,
	TOutputSchema extends z.ZodTypeAny,
>(definition: WorkspaceCapabilityToolDefinition<TName, TInputSchema, TOutputSchema>) {
	return definition;
}

export const workspaceCapabilityToolDefinitions = [
	defineWorkspaceCapabilityTool({
		name: "workspace_list_items",
		description: "List items in the actual ThinkEx workspace by absolute path.",
		inputSchema: workspaceListItemsInputSchema,
		inputExamples: workspaceListItemsInputExamples,
		outputSchema: workspaceListItemsOutputSchema,
		scopes: workspaceReadCapabilityScopes,
		mutating: false,
		execute: async ({ limit, path, recursive }, context) => {
			return await listWorkspaceCapabilityItems(context, {
				path,
				recursive,
				limit,
			});
		},
	}),
	defineWorkspaceCapabilityTool({
		name: "workspace_read_items",
		description:
			"Read ThinkEx documents and files by absolute path. Use pages for continuation: PDF pages for PDFs, 1000-line Markdown pages for documents and extracted files. Defaults to page 1. Check pages.total before reading more.",
		inputSchema: workspaceReadItemsInputSchema,
		inputExamples: workspaceReadItemsInputExamples,
		outputSchema: workspaceReadItemsOutputSchema,
		scopes: workspaceReadCapabilityScopes,
		mutating: false,
		execute: async ({ pages, paths }, context) => {
			return await readWorkspaceCapabilityItems(context, {
				pages,
				paths,
			});
		},
	}),
	defineWorkspaceCapabilityTool({
		name: "workspace_rename_item",
		description:
			"Rename one actual ThinkEx workspace item by absolute path. If the requested final path already exists, the rename fails instead of auto-renaming.",
		inputSchema: workspaceRenameItemInputSchema,
		inputExamples: workspaceRenameItemInputExamples,
		outputSchema: workspaceRenameItemOutputSchema,
		scopes: workspaceMutateCapabilityScopes,
		mutating: true,
		execute: async ({ name, path }, context) => {
			return await renameWorkspaceCapabilityItem(context, {
				name,
				path,
			});
		},
	}),
	defineWorkspaceCapabilityTool({
		name: "workspace_move_items",
		description:
			"Move one or more actual ThinkEx workspace items into an existing folder or the workspace root. If the destination already has the same name, that move fails instead of auto-renaming.",
		inputSchema: workspaceMoveItemsInputSchema,
		inputExamples: workspaceMoveItemsInputExamples,
		outputSchema: workspaceMoveItemsOutputSchema,
		scopes: workspaceMutateCapabilityScopes,
		mutating: true,
		execute: async ({ destinationPath, paths }, context) => {
			return await moveWorkspaceCapabilityItems(context, {
				destinationPath,
				paths,
			});
		},
	}),
	defineWorkspaceCapabilityTool({
		name: "workspace_create_items",
		description: `Create one or more folders or documents at exact absolute paths. If a path already exists, creation fails instead of renaming. ${workspaceDocumentMarkdownMathInstruction}`,
		inputSchema: workspaceCreateItemsInputSchema,
		inputExamples: workspaceCreateItemsInputExamples,
		outputSchema: workspaceCreateItemsOutputSchema,
		scopes: workspaceMutateCapabilityScopes,
		mutating: true,
		execute: async ({ items }, context) => {
			return await createWorkspaceCapabilityItems(context, {
				items,
			});
		},
	}),
	defineWorkspaceCapabilityTool({
		name: "workspace_delete_items",
		description: "Delete one or more actual ThinkEx workspace items by absolute path.",
		inputSchema: workspaceDeleteItemsInputSchema,
		inputExamples: workspaceDeleteItemsInputExamples,
		outputSchema: workspaceDeleteItemsOutputSchema,
		scopes: workspaceMutateCapabilityScopes,
		mutating: true,
		execute: async ({ paths }, context) => {
			return await deleteWorkspaceCapabilityItems(context, {
				paths,
			});
		},
	}),
	defineWorkspaceCapabilityTool({
		name: "workspace_edit_item",
		description: `Edit one actual ThinkEx workspace document by absolute path. Read before editing unless the user requested a simple append or prepend. ${workspaceDocumentMarkdownMathInstruction}`,
		inputSchema: workspaceEditItemInputSchema,
		inputExamples: workspaceEditItemInputExamples,
		outputSchema: workspaceEditItemOutputSchema,
		scopes: workspaceMutateCapabilityScopes,
		mutating: true,
		execute: async ({ path, edits }, context) => {
			return await editWorkspaceCapabilityItem(context, {
				path,
				edits,
			});
		},
	}),
] as const;

export type WorkspaceCapabilityToolName =
	(typeof workspaceCapabilityToolDefinitions)[number]["name"];
