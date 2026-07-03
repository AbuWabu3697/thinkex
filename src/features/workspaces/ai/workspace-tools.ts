import type { ToolSet } from "ai";
import { tool } from "ai";

import type { AIThreadContext } from "#/features/workspaces/ai/ai-thread-metadata";
import {
	workspaceCapabilityToolDefinitions,
	type WorkspaceCapabilityToolDefinition,
} from "#/features/workspaces/capabilities/workspace-capability-tools";
import {
	createWorkspaceCapabilityContext,
	type WorkspaceCapabilityContext,
	type WorkspaceCapabilityScope,
} from "#/features/workspaces/capabilities/workspace-capability-context";

type WorkspaceThreadToolConfig = {
	definition: WorkspaceCapabilityToolDefinition;
	getThreadContext: () => Promise<AIThreadContext | null>;
};

function createWorkspaceThreadTool(input: WorkspaceThreadToolConfig) {
	const { definition } = input;

	return tool({
		description: definition.description,
		inputSchema: definition.inputSchema,
		inputExamples: definition.inputExamples,
		outputSchema: definition.outputSchema,
		strict: true,
		execute: async (args) => {
			const thread = await requireThreadContext(input.getThreadContext);

			return await definition.execute(
				args,
				createThreadWorkspaceCapabilityContext(thread, definition.scopes),
			);
		},
	});
}

export function createAIThreadWorkspaceTools(input: {
	getThreadContext: () => Promise<AIThreadContext | null>;
}): ToolSet {
	return Object.fromEntries(
		workspaceCapabilityToolDefinitions.map((definition) => [
			definition.name,
			createWorkspaceThreadTool({
				definition,
				getThreadContext: input.getThreadContext,
			}),
		]),
	) as ToolSet;
}

async function requireThreadContext(getThreadContext: () => Promise<AIThreadContext | null>) {
	const thread = await getThreadContext();

	if (!thread) {
		throw new Error("Chat thread not found");
	}

	return thread;
}

function createThreadWorkspaceCapabilityContext(
	thread: AIThreadContext,
	scopes: readonly WorkspaceCapabilityScope[],
): WorkspaceCapabilityContext {
	return createWorkspaceCapabilityContext({
		scopes,
		userId: thread.userId,
		workspaceId: thread.workspaceId,
	});
}
