import { env } from "cloudflare:workers";

import { normalizeWorkspaceItemName } from "#/features/workspaces/defaults";
import {
	parseTiptapDocumentJson,
	type TiptapDocumentJson,
} from "#/features/workspaces/documents/tiptap-document";
import { createWorkspaceExportStream } from "#/features/workspaces/export/workspace-export-archive";
import { getWorkspaceKernel } from "#/features/workspaces/kernel/workspace-kernel-access";
import { WorkspaceForbiddenError } from "#/features/workspaces/server/permissions";
import { getWorkspacePageForUser } from "#/features/workspaces/server/queries";

export async function createWorkspaceExport(input: { workspaceId: string; userId: string }) {
	const page = await getWorkspacePageForUser(input.workspaceId, input.userId);
	if (!page) {
		throw new WorkspaceForbiddenError();
	}

	const kernel = await getWorkspaceKernel(input.workspaceId);
	const documents = new Map<string, TiptapDocumentJson>();
	const fileObjectKeys = new Map<string, string>();

	// Resolve fallible metadata before the response starts streaming. Once ZIP
	// bytes are sent, an error can only abort the download and leave a partial archive.
	for (const item of page.items) {
		if (item.type === "document") {
			const { content } = await kernel.readDocumentCheckpoint({ itemId: item.id });
			documents.set(item.id, parseTiptapDocumentJson(content));
			continue;
		}
		if (item.type === "file") {
			const source = await kernel.getFileSource({ itemId: item.id });
			if (!(await env.WORKSPACE_KERNEL_FILES.head(source.objectKey))) {
				throw new Error(`Workspace file source is missing for ${item.name}.`);
			}
			fileObjectKeys.set(item.id, source.objectKey);
		}
	}

	return {
		fileName: `${normalizeWorkspaceItemName(page.workspace.name, "Workspace")}-${new Date().toISOString().slice(0, 10)}.zip`,
		stream: createWorkspaceExportStream(page.items, {
			readDocument: (item) => {
				const document = documents.get(item.id);
				if (!document) {
					throw new Error(`Workspace document was not prepared for ${item.name}.`);
				}
				return document;
			},
			readFile: async (item) => {
				const objectKey = fileObjectKeys.get(item.id);
				if (!objectKey) {
					throw new Error(`Workspace file was not prepared for ${item.name}.`);
				}
				const object = await env.WORKSPACE_KERNEL_FILES.get(objectKey);
				if (!object) {
					throw new Error(`Workspace file source is missing for ${item.name}.`);
				}
				return object.body;
			},
		}),
	};
}
