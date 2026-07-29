import { generateTypes } from "@cloudflare/codemode/ai";
import type { ToolSet } from "ai";

import { requireAIThreadToolRuntime } from "#/features/workspaces/ai/ai-thread-tool";

/**
 * The TypeScript block the model writes Code Mode against.
 *
 * The tool a provider sees is deliberately lossy: `getModelToolDefinition`
 * drops `outputSchema` so it never has to survive a provider's JSON Schema
 * dialect, and `modelInputSchema` flattens unions that some providers reject.
 * Code Mode is not a provider — it hands the model TypeScript, which
 * represents both faithfully — so generate types from the runtime's real
 * schemas. Without this, every method reads as `Promise<unknown>` and every
 * flattened union loses the fields it makes conditional.
 *
 * This mirrors what `AIThreadToolSetConnector` publishes as the connector's
 * JSON Schema, so the types and the contract agree.
 */
export function generateAIThreadCodemodeTypes(toolSet: ToolSet, namespace: string) {
	const typedToolSet = Object.fromEntries(
		Object.entries(toolSet).map(([toolName, aiTool]) => {
			const runtime = requireAIThreadToolRuntime(toolName, aiTool);
			return [
				toolName,
				{ ...aiTool, inputSchema: runtime.inputSchema, outputSchema: runtime.outputSchema },
			];
		}),
	);

	return generateTypes(typedToolSet, namespace);
}
