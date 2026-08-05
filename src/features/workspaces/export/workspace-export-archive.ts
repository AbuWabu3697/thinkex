import { Zip, ZipPassThrough } from "fflate";

import type { WorkspaceItemSummary } from "#/features/workspaces/contracts";
import { serializeTiptapDocumentToMarkdown } from "#/features/workspaces/documents/document-markdown";
import type { TiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import { buildWorkspaceKernelItemPathIndex } from "#/features/workspaces/kernel/workspace-kernel-paths";

const emptyBytes = new Uint8Array();
const textEncoder = new TextEncoder();

interface WorkspaceExportReaders {
	readDocument: (item: WorkspaceItemSummary) => TiptapDocumentJson;
	readFile: (item: WorkspaceItemSummary) => Promise<ReadableStream<Uint8Array>>;
}

export function createWorkspaceExportStream(
	items: readonly WorkspaceItemSummary[],
	readers: WorkspaceExportReaders,
) {
	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
	void writeWorkspaceExport(writable, items, readers);
	return readable;
}

async function writeWorkspaceExport(
	writable: WritableStream<Uint8Array>,
	items: readonly WorkspaceItemSummary[],
	readers: WorkspaceExportReaders,
) {
	const writer = writable.getWriter();
	let output = Promise.resolve();
	const zip = new Zip((error, data, final) => {
		if (error) {
			output = output.then(() => writer.abort(error));
			return;
		}

		output = output.then(() => writer.write(data));
		if (final) {
			output = output.then(() => writer.close());
		}
	});

	try {
		const paths = buildWorkspaceKernelItemPathIndex([...items]);
		const archivePaths = buildArchivePathIndex(items, paths);
		for (const item of items) {
			const path = archivePaths.get(item.id);
			if (!path) {
				continue;
			}

			if (item.type === "folder") {
				await addZipBytes(zip, `${path}/`, emptyBytes, () => output);
				continue;
			}
			if (item.type === "document") {
				const markdown = serializeTiptapDocumentToMarkdown(readers.readDocument(item));
				await addZipBytes(zip, path, textEncoder.encode(`${markdown}\n`), () => output);
				continue;
			}
			if (item.type === "file") {
				await addZipStream(zip, path, await readers.readFile(item), () => output);
			}
		}

		zip.end();
		await output;
	} catch (error) {
		zip.terminate();
		await writer.abort(error).catch(() => undefined);
	}
}

function buildArchivePathIndex(
	items: readonly WorkspaceItemSummary[],
	workspacePaths: ReadonlyMap<string, string>,
) {
	const archivePaths = new Map<string, string>();
	const reservedPaths = new Set<string>();

	for (const item of items) {
		if (item.type !== "folder" && item.type !== "file") {
			continue;
		}
		const path = workspacePaths.get(item.id)?.slice(1);
		if (path) {
			archivePaths.set(item.id, path);
			reservedPaths.add(path.toLowerCase());
		}
	}

	for (const item of items) {
		if (item.type !== "document") {
			continue;
		}
		const workspacePath = workspacePaths.get(item.id)?.slice(1);
		if (!workspacePath) {
			continue;
		}

		const markdownPath = workspacePath.toLowerCase().endsWith(".md")
			? workspacePath
			: `${workspacePath}.md`;
		const path = reserveArchivePath(markdownPath, reservedPaths);
		archivePaths.set(item.id, path);
		reservedPaths.add(path.toLowerCase());
	}

	return archivePaths;
}

function reserveArchivePath(path: string, reservedPaths: ReadonlySet<string>) {
	if (!reservedPaths.has(path.toLowerCase())) {
		return path;
	}

	const base = path.slice(0, -3);
	for (let suffix = 2; ; suffix += 1) {
		const candidate = `${base} (${suffix}).md`;
		if (!reservedPaths.has(candidate.toLowerCase())) {
			return candidate;
		}
	}
}

async function addZipBytes(
	zip: Zip,
	path: string,
	bytes: Uint8Array,
	getOutput: () => Promise<void>,
) {
	const file = new ZipPassThrough(path);
	zip.add(file);
	file.push(bytes, true);
	await getOutput();
}

async function addZipStream(
	zip: Zip,
	path: string,
	stream: ReadableStream<Uint8Array>,
	getOutput: () => Promise<void>,
) {
	const file = new ZipPassThrough(path);
	zip.add(file);
	const reader = stream.getReader();

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			file.push(emptyBytes, true);
			await getOutput();
			return;
		}

		file.push(value);
		await getOutput();
	}
}
