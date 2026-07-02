import {
	getWorkspaceCapabilityPageContext,
	resolveWorkspaceCapabilityPath,
} from "#/features/workspaces/capabilities/common";
import {
	readWorkspaceCapabilityProjectionPages,
	WorkspaceCapabilityPageError,
	type WorkspaceCapabilityReadPages,
} from "#/features/workspaces/capabilities/read-pages";
import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { serializeTiptapDocumentToMarkdown } from "#/features/workspaces/documents/document-markdown";
import { parseMarkdownPagesProjection } from "#/features/workspaces/extraction/page-markdown-projection";
import { parseTiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";
import { resolveWorkspaceFileTypeFromItem } from "#/features/workspaces/model/workspace-file";
import type { WorkspaceCapabilityContext } from "#/features/workspaces/capabilities/workspace-capability-context";

export interface ReadWorkspaceCapabilityItemsInput {
	pages?: string;
	paths: string[];
}

export interface WorkspaceCapabilityReadItem {
	content?: string;
	pages?: WorkspaceCapabilityReadPages;
	path: string;
	status: "failed" | "pending" | "ready" | "unsupported";
	type: "document" | "file" | "flashcard" | "quiz";
}

export interface WorkspaceCapabilityReadItemsResult {
	items: WorkspaceCapabilityReadItem[];
	failed: WorkspaceCapabilityReadFailure[];
}

const WORKSPACE_READ_MARKDOWN_LINES_PER_PAGE = 1000;
const MAX_AI_READ_LINE_LENGTH = 2000;
const TRUNCATED_LINE_SUFFIX = `... (line truncated to ${MAX_AI_READ_LINE_LENGTH} chars)`;

type WorkspaceCapabilityReadFailureCode =
	| "page_range_out_of_range"
	| "path_is_folder"
	| "path_not_absolute"
	| "path_not_found";

interface WorkspaceCapabilityReadFailure {
	code: WorkspaceCapabilityReadFailureCode;
	index: number;
	path: string;
}

export async function readWorkspaceCapabilityItems(
	capabilityContext: WorkspaceCapabilityContext,
	input: ReadWorkspaceCapabilityItemsInput,
): Promise<WorkspaceCapabilityReadItemsResult> {
	const workspaceContext = await getWorkspaceCapabilityPageContext({
		access: "read",
		context: capabilityContext,
	});
	const result: WorkspaceCapabilityReadItemsResult = {
		items: [],
		failed: [],
	};

	for (const [index, path] of input.paths.entries()) {
		const resolution = resolveWorkspaceCapabilityPath({
			path,
			tree: workspaceContext.tree,
		});

		if (resolution.status === "invalid_path") {
			result.failed.push({
				code: resolution.code,
				index,
				path: resolution.path,
			});
			continue;
		}

		if (resolution.status === "root") {
			result.failed.push({
				code: "path_is_folder",
				index,
				path: resolution.path,
			});
			continue;
		}

		if (resolution.status === "not_found") {
			result.failed.push({
				code: "path_not_found",
				index,
				path: resolution.path,
			});
			continue;
		}

		if (resolution.item.type === "folder") {
			result.failed.push({
				code: "path_is_folder",
				index,
				path: resolution.path,
			});
			continue;
		}

		try {
			result.items.push(
				await readWorkspaceCapabilityItem({
					item: resolution.item,
					kernel: workspaceContext.kernel,
					pages: input.pages,
					path: resolution.path,
				}),
			);
		} catch (error) {
			if (error instanceof WorkspaceCapabilityPageError) {
				result.failed.push({
					code: error.code,
					index,
					path: resolution.path,
				});
				continue;
			}

			throw error;
		}
	}

	return result;
}

async function readWorkspaceCapabilityItem(input: {
	item: WorkspaceItemSummary;
	kernel: WorkspaceKernelClient;
	pages?: string;
	path: string;
}): Promise<WorkspaceCapabilityReadItem> {
	const { item } = input;

	if (item.type === "folder") {
		throw new Error("Folder paths should be handled before item reads.");
	}

	if (item.type === "document") {
		const { content } = await input.kernel.readItem({ itemId: item.id });
		const markdown = serializeTiptapDocumentToMarkdown(parseTiptapDocumentJson(content));
		const page = readWorkspaceAiMarkdownPages(markdown, { pages: input.pages });

		return {
			content: page.content,
			pages: page.pages,
			path: input.path,
			status: "ready",
			type: "document",
		};
	}

	if (item.type === "file") {
		return await readWorkspaceCapabilityFileItem(input);
	}

	return {
		path: input.path,
		status: "unsupported",
		type: item.type,
	};
}

async function readWorkspaceCapabilityFileItem(input: {
	item: WorkspaceItemSummary;
	kernel: WorkspaceKernelClient;
	pages?: string;
	path: string;
}): Promise<WorkspaceCapabilityReadItem> {
	const { item } = input;
	const fileType = resolveWorkspaceFileTypeFromItem(item);

	if (!fileType) {
		return createWorkspaceCapabilityFileStatusItem(input.path, "unsupported");
	}

	if (fileType.aiReadStrategy !== "markdown_extraction") {
		return createWorkspaceCapabilityFileStatusItem(input.path, "unsupported");
	}

	const pagesProjection = await input.kernel.readFileProjection({
		itemId: item.id,
		format: "pages",
	});

	if (
		pagesProjection?.status === "queued" ||
		pagesProjection?.status === "processing" ||
		pagesProjection?.status === "not_started"
	) {
		return createWorkspaceCapabilityFileStatusItem(input.path, "pending");
	}

	if (!pagesProjection) {
		return createWorkspaceCapabilityFileStatusItem(input.path, "pending");
	}

	if (pagesProjection.status !== "ready" || pagesProjection.content === null) {
		return createWorkspaceCapabilityFileStatusItem(input.path, "failed");
	}

	const pageRead = readWorkspaceCapabilityProjectionPages(
		parseMarkdownPagesProjection(pagesProjection.content),
		{
			pages: input.pages,
		},
	);

	return {
		content: pageRead.content,
		pages: pageRead.pages,
		path: input.path,
		status: "ready",
		type: "file",
	};
}

function createWorkspaceCapabilityFileStatusItem(
	path: string,
	status: WorkspaceCapabilityReadItem["status"],
): WorkspaceCapabilityReadItem {
	return {
		path,
		status,
		type: "file",
	};
}

function readWorkspaceAiMarkdownPages(
	content: string,
	input: { pages?: string },
): { content: string; pages: WorkspaceCapabilityReadPages } {
	const lines = content === "" ? [] : content.split(/\r?\n/);
	const totalPages = Math.max(1, Math.ceil(lines.length / WORKSPACE_READ_MARKDOWN_LINES_PER_PAGE));
	const requested = input.pages?.trim() || "1";
	const selectedPageNumbers = parseWorkspaceAiPageRange(requested, totalPages);

	const selectedLines: string[] = [];

	for (const pageNumber of selectedPageNumbers) {
		const startIndex = (pageNumber - 1) * WORKSPACE_READ_MARKDOWN_LINES_PER_PAGE;
		const pageLines = lines.slice(startIndex, startIndex + WORKSPACE_READ_MARKDOWN_LINES_PER_PAGE);

		for (const rawLine of pageLines) {
			const line = truncateWorkspaceAiMarkdownLine(rawLine);
			selectedLines.push(line.value);
		}
	}

	return {
		content: selectedLines.join("\n"),
		pages: {
			requested,
			returned: selectedPageNumbers,
			total: totalPages,
		},
	};
}

function parseWorkspaceAiPageRange(value: string, totalPages: number) {
	const selected = new Set<number>();
	const parts = value.split(",");

	for (const rawPart of parts) {
		const part = rawPart.trim();

		if (!part) {
			continue;
		}

		const rangeMatch = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);

		if (!rangeMatch) {
			throw new WorkspaceCapabilityPageError("page_range_out_of_range");
		}

		const start = Number(rangeMatch[1]);
		const end = Number(rangeMatch[2] ?? rangeMatch[1]);

		if (start < 1 || end < start || end > totalPages) {
			throw new WorkspaceCapabilityPageError("page_range_out_of_range");
		}

		for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
			selected.add(pageNumber);
		}
	}

	if (selected.size === 0) {
		throw new WorkspaceCapabilityPageError("page_range_out_of_range");
	}

	return Array.from(selected).sort((left, right) => left - right);
}

function truncateWorkspaceAiMarkdownLine(line: string) {
	if (line.length <= MAX_AI_READ_LINE_LENGTH) {
		return { truncated: false, value: line };
	}

	return {
		truncated: true,
		value: line.slice(0, MAX_AI_READ_LINE_LENGTH) + TRUNCATED_LINE_SUFFIX,
	};
}
