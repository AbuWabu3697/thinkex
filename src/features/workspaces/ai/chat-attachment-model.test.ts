import type { ModelMessage } from "ai";
import { describe, expect, it, vi } from "vitest";

import { resolveChatAttachmentModelMessages } from "#/features/workspaces/ai/chat-attachment-model";

describe("resolveChatAttachmentModelMessages", () => {
	it("hydrates AI SDK URL file parts from the owning R2 object", async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const get = vi.fn().mockResolvedValue({
			arrayBuffer: async () => bytes.buffer,
			httpMetadata: { contentType: "image/png" },
			size: bytes.byteLength,
		});
		const messages: ModelMessage[] = [
			{
				content: [
					{
						data: {
							type: "url",
							url: new URL(
								"https://thinkex.app/api/v1/workspaces/workspace-1/ai-threads/thread-1/attachments/file-1",
							),
						},
						filename: "diagram.png",
						mediaType: "image/webp",
						type: "file",
					},
				],
				role: "user",
			},
		];

		const result = await resolveChatAttachmentModelMessages({
			bucket: { get } as unknown as R2Bucket,
			messages,
			threadId: "thread-1",
			userId: "user-1",
			workspaceId: "workspace-1",
		});

		expect(get).toHaveBeenCalledExactlyOnceWith(
			"chat-attachments/workspaces/workspace-1/users/user-1/threads/thread-1/attachments/file-1",
		);
		expect(result).toEqual([
			{
				content: [
					{
						data: { data: bytes, type: "data" },
						filename: "diagram.png",
						mediaType: "image/png",
						type: "file",
					},
				],
				role: "user",
			},
		]);
	});
});
