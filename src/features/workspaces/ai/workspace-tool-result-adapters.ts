import type { JSONValue } from "ai";
import { z } from "zod";

import { workspaceReadItemsOutputSchema } from "#/features/workspaces/content/workspace-content-contract";
import { createWorkspaceReadItemsModelOutput } from "#/features/workspaces/content/workspace-read-references";
import {
	workspaceReferenceRecordSchema,
	type WorkspaceReferenceRecord,
} from "#/features/workspaces/locations/workspace-location";
import { workspaceSearchOutputSchema } from "#/features/workspaces/search/workspace-search-contract";
import { createWorkspaceSearchModelOutput } from "#/features/workspaces/search/workspace-search-references";

function defineWorkspaceToolResultAdapter<TSchema extends z.ZodTypeAny>(input: {
	collectReferences: (output: z.output<TSchema>) => readonly WorkspaceReferenceRecord[];
	outputSchema: TSchema;
	projectOutput: (output: z.output<TSchema>) => unknown;
}) {
	return {
		collectReferences: (output: unknown) => {
			const parsed = input.outputSchema.safeParse(output);
			return parsed.success ? input.collectReferences(parsed.data) : [];
		},
		projectOutput: (output: unknown) => {
			return input.projectOutput(input.outputSchema.parse(output)) as JSONValue;
		},
	};
}

const workspaceReadItemsResultAdapter = defineWorkspaceToolResultAdapter({
	collectReferences: (output) => output.references,
	outputSchema: workspaceReadItemsOutputSchema,
	projectOutput: createWorkspaceReadItemsModelOutput,
});

const workspaceSearchResultAdapter = defineWorkspaceToolResultAdapter({
	collectReferences: (output) => output.references,
	outputSchema: workspaceSearchOutputSchema,
	projectOutput: createWorkspaceSearchModelOutput,
});

const workspaceCreateItemsResultAdapter = defineWorkspaceToolResultAdapter({
	collectReferences: (output) => output.references,
	outputSchema: z.object({
		failed: z.array(z.object({ code: z.string(), index: z.number(), path: z.string() })),
		items: z.array(
			z.object({
				itemId: z.string(),
				path: z.string(),
				type: z.enum(["document", "folder"]),
				warnings: z.array(z.string()).optional(),
			}),
		),
		references: z.array(workspaceReferenceRecordSchema),
	}),
	projectOutput: (output) => {
		const refsByItemId = new Map(
			output.references.flatMap((record) =>
				record.location.kind === "item" ? [[record.location.itemId, record.ref] as const] : [],
			),
		);

		return {
			failed: output.failed,
			items: output.items.map(({ itemId, path, type, warnings }) => {
				const reference = refsByItemId.get(itemId);

				return {
					path,
					...(reference ? { reference } : {}),
					type,
					...(warnings ? { warnings } : {}),
				};
			}),
		};
	},
});

const workspaceToolResultAdapters = {
	workspace_create_items: workspaceCreateItemsResultAdapter,
	workspace_read_items: workspaceReadItemsResultAdapter,
	workspace_search: workspaceSearchResultAdapter,
} as const;

export function getWorkspaceToolResultAdapter(name: string) {
	return Object.hasOwn(workspaceToolResultAdapters, name)
		? workspaceToolResultAdapters[name as keyof typeof workspaceToolResultAdapters]
		: null;
}
