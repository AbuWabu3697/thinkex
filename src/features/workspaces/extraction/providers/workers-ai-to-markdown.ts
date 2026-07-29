import { normalizeChatImageToJpeg } from "#/features/workspaces/conversion/image-normalizer";
import { WORKSPACE_AI_CHAT_ATTACHMENT_POLICY } from "#/features/workspaces/ai/chat-attachment-policy";
import type {
	MarkdownExtractionProvider,
	MarkdownExtractionResult,
} from "#/features/workspaces/extraction/types";
import { createSingleMarkdownProjectionPage } from "#/features/workspaces/extraction/page-markdown-projection";

export function createWorkersAiToMarkdownProvider(env: Env): MarkdownExtractionProvider {
	return {
		id: "workers_ai_to_markdown",
		async extract(input) {
			const conversion = await normalizeChatImageToJpeg(
				env,
				input.openBody,
				WORKSPACE_AI_CHAT_ATTACHMENT_POLICY.maxNormalizedFileSize,
			);
			const result = await env.AI.toMarkdown(
				{
					name: input.fileName,
					blob: new Blob([conversion.bytes], {
						type: "image/jpeg",
					}),
				},
				{
					conversionOptions: {
						image: {
							descriptionLanguage: "en",
						},
					},
				},
			);

			if (result.format === "error") {
				throw new Error(`Workers AI toMarkdown failed: ${result.error}`);
			}

			const markdown = result.data.trim();

			if (!markdown) {
				throw new Error("Workers AI toMarkdown completed without markdown output.");
			}

			return {
				pages: createSingleMarkdownProjectionPage(markdown),
				provider: "workers_ai_to_markdown",
				providerMode: "default",
				metadata: getWorkersAiToMarkdownMetadata(result),
			} satisfies MarkdownExtractionResult;
		},
	};
}

function getWorkersAiToMarkdownMetadata(result: { mimeType: string; tokens: number }) {
	return {
		mimeType: result.mimeType,
		tokens: result.tokens,
	};
}
