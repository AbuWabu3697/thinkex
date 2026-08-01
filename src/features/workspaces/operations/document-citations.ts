import {
	applyDocumentCitationItemIds,
	readDocumentCitationPaths,
} from "#/features/workspaces/documents/document-ai-html";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";

/**
 * Turn the paths an assistant cited into the item ids a document can keep.
 *
 * The assistant cites what it knows — an absolute path — but a path changes
 * when an item is renamed or moved, and a document outlives the turn that
 * wrote it. Resolving here, where paths are resolved anyway, means the stored
 * citation survives both.
 */
export async function resolveDocumentCitations(input: {
	html: string;
	kernel: WorkspaceKernelClient;
}): Promise<string> {
	const paths = readDocumentCitationPaths(input.html);

	if (paths.length === 0) {
		return input.html;
	}

	const resolutions = await input.kernel.resolvePaths({ paths });
	const itemIdsByPath = new Map(
		resolutions.flatMap((resolution) =>
			resolution.status === "item" ? [[resolution.path, resolution.item.id] as const] : [],
		),
	);

	return applyDocumentCitationItemIds(input.html, itemIdsByPath);
}
