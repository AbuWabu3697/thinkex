import type { ToolSet } from "ai";
import { zodSchema } from "ai";
import { z } from "zod";
import { defineAIThreadTool } from "#/features/workspaces/ai/ai-thread-tool";
import {
	deepenResearchWithPassages,
	deepenResearchWithRelated,
	discoverResearch,
	researchDeepenResultSchema,
	researchDiscoverResultSchema,
} from "#/integrations/firecrawl/research";

const researchDiscoverInputSchema = z.object({
	query: z.string().trim().min(1).describe("Research topic or question."),
	include_github: z
		.boolean()
		.optional()
		.describe("Whether to include related implementation discussions and repositories."),
});

const researchDeepenInputSchema = z.discriminatedUnion("mode", [
	z.object({
		mode: z.literal("passages"),
		paper_id: z.string().trim().min(1).describe("Paper identifier."),
		question: z.string().trim().min(1).describe("Question to answer from the paper."),
	}),
	z.object({
		mode: z.literal("related"),
		paper_id: z.string().trim().min(1).describe("Paper identifier."),
		relation: z
			.enum(["similar", "citers", "references"])
			.describe("Which related papers to return."),
		intent: z.string().trim().min(1).describe("What kind of related work to prioritize."),
	}),
]);

/** Gemini requires custom-tool parameters to be a top-level object. */
const researchDeepenModelInputSchema = z.object({
	mode: z.enum(["passages", "related"]),
	paper_id: z.string().trim().min(1).describe("Paper identifier."),
	question: z.string().trim().min(1).optional().describe("Required for passage retrieval."),
	relation: z
		.enum(["similar", "citers", "references"])
		.optional()
		.describe("Required for related work."),
	intent: z.string().trim().min(1).optional().describe("Required for related work."),
});

const researchDiscoverInputExamples = [
	{
		input: {
			query: "efficient transformers for long context",
		},
	},
	{
		input: {
			query: "vision-language model implementation bugs",
			include_github: true,
		},
	},
];

export function createAIThreadResearchTools(env: Cloudflare.Env): ToolSet {
	return {
		research_discover: defineAIThreadTool({
			description:
				"Find relevant research papers for a topic or question. Optionally include related implementation discussions and repositories.",
			inputSchema: researchDiscoverInputSchema,
			inputExamples: researchDiscoverInputExamples,
			outputSchema: researchDiscoverResultSchema,
			execute: async ({ query, include_github }) =>
				discoverResearch({
					env,
					query,
					includeGithub: include_github ?? false,
				}),
		}),
		research_deepen: defineAIThreadTool({
			description: "Go deeper on one paper by reading relevant passages or finding related work.",
			inputSchema: zodSchema(researchDeepenInputSchema),
			modelInputSchema: researchDeepenModelInputSchema,
			outputSchema: researchDeepenResultSchema,
			execute: async (input: z.infer<typeof researchDeepenInputSchema>) => {
				if (input.mode === "passages") {
					return deepenResearchWithPassages({
						env,
						paperId: input.paper_id,
						question: input.question,
					});
				}

				return deepenResearchWithRelated({
					env,
					paperId: input.paper_id,
					relation: input.relation,
					intent: input.intent,
				});
			},
		}),
	};
}
