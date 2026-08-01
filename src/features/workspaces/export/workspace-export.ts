import type { WorkspaceItemSummary, WorkspacePage } from "#/features/workspaces/contracts";
import { serializeTiptapDocumentToMarkdown } from "#/features/workspaces/documents/document-markdown";
import { parseTiptapDocumentJson } from "#/features/workspaces/documents/tiptap-document";
import type { WorkspaceKernelClient } from "#/features/workspaces/kernel/workspace-kernel-access";
import { applyWorkspaceEventToPage } from "#/features/workspaces/model/workspace-page";
import type { WorkspaceRealtimeEvent } from "#/features/workspaces/realtime/messages";
import { createStreamingMultipartFile } from "#/lib/http/streaming-multipart";
import { requireSizedResponseBody } from "#/lib/http/sized-response-body";
import { createZipArchive, type ZipEntryInput } from "./workspace-zip";

export interface WorkspaceExportInput {
	env: Cloudflare.Env;
	kernel: WorkspaceKernelClient;
	page: WorkspacePage;
	userId: string;
}

const gotenbergChromiumHtmlPath = "/forms/chromium/convert/html";
const gotenbergChromiumHtmlFileName = "index.html";
const pdfConverterPoolSize = 2;
const textEncoder = new TextEncoder();

interface WorkspacePdfConverter {
	fetch(request: Request): Promise<Response>;
	startAndWaitForPorts(options: {
		cancellationOptions: { portReadyTimeoutMS: number };
	}): unknown;
}

export async function exportWorkspaceToZip(input: WorkspaceExportInput) {
	const page = reconstructWorkspaceState({
		eventsAfterSnapshot: [],
		snapshot: input.page,
	});
	const entries = await buildWorkspaceExportEntries(input.env, input.kernel, page);
	const archive = createZipArchive(entries);
	const fileName = `${sanitizeExportName(page.workspace.name)}.zip`;

	return {
		body: archive,
		fileName,
	};
}

export function reconstructWorkspaceState(input: {
	eventsAfterSnapshot: WorkspaceRealtimeEvent[];
	snapshot: WorkspacePage;
}): WorkspacePage {
	return [...input.eventsAfterSnapshot]
		.sort((left, right) => left.revision - right.revision)
		.reduce(applyWorkspaceEventToPage, input.snapshot);
}

export async function buildWorkspaceExportEntries(
	env: Cloudflare.Env,
	kernel: WorkspaceKernelClient,
	page: WorkspacePage,
): Promise<ZipEntryInput[]> {
	const workspaceFolderName = sanitizeExportName(page.workspace.name);
	const pathIndex = buildWorkspaceExportPathIndex(workspaceFolderName, page.items);
	const entries: ZipEntryInput[] = [{ path: `${workspaceFolderName}/` }];
	const usedZipPaths = new Set<string>([`${workspaceFolderName}/`.toLocaleLowerCase()]);

	for (const item of page.items) {
		const zipPath = pathIndex.get(item.id);
		if (!zipPath) {
			continue;
		}

		if (item.type === "folder") {
			entries.push({
				modifiedAt: new Date(item.updatedAt),
				path: reserveUniqueZipPath(`${zipPath}/`, usedZipPaths),
			});
			continue;
		}

		if (item.type === "document") {
			entries.push({
				data: await renderWorkspaceDocumentPdf(env, kernel, item),
				modifiedAt: new Date(item.updatedAt),
				path: reserveUniqueZipPath(`${stripExportExtension(zipPath)}.pdf`, usedZipPaths),
			});
			continue;
		}

		if (item.type === "file") {
			try {
				const source = await kernel.getFileSource({ itemId: item.id });
				const object = await env.WORKSPACE_KERNEL_FILES.get(source.objectKey);

				if (!object) {
					throw new Error("Workspace file object was not found.");
				}

				entries.push({
					data: await object.arrayBuffer(),
					modifiedAt: new Date(item.updatedAt),
					path: reserveUniqueZipPath(
						replacePathBaseName(zipPath, sanitizeExportName(source.fileName)),
						usedZipPaths,
					),
				});
			} catch (error) {
				void recordWorkspaceExportFailure({
					error,
					event: "workspace_export_file",
					fields: {
						item_id: item.id,
						workspace_id: item.workspaceId,
					},
				});
				entries.push({
					data: createMissingWorkspaceFileNotice(item.name),
					modifiedAt: new Date(item.updatedAt),
					path: reserveUniqueZipPath(`${zipPath}.missing.txt`, usedZipPaths),
				});
			}
		}
	}

	return entries;
}

function createMissingWorkspaceFileNotice(fileName: string) {
	return textEncoder.encode(
		[
			`The file "${fileName}" could not be included in this export.`,
			"",
			"Its stored file data is missing from the workspace file storage.",
		].join("\n"),
	);
}

export function buildWorkspaceExportPathIndex(
	workspaceFolderName: string,
	items: WorkspaceItemSummary[],
) {
	const childrenByParentId = new Map<string | null, WorkspaceItemSummary[]>();
	const pathsByItemId = new Map<string, string>();

	for (const item of items) {
		const children = childrenByParentId.get(item.parentId) ?? [];
		children.push(item);
		childrenByParentId.set(item.parentId, children);
	}

	const visit = (parentId: string | null, parentPath: string) => {
		const usedNames = new Set<string>();
		const children = [...(childrenByParentId.get(parentId) ?? [])].sort(compareExportItems);

		for (const item of children) {
			const name = createUniqueExportName(sanitizeExportName(item.name), usedNames);
			const path = `${parentPath}/${name}`;
			pathsByItemId.set(item.id, path);

			if (item.type === "folder") {
				visit(item.id, path);
			}
		}
	};

	visit(null, workspaceFolderName);
	return pathsByItemId;
}

export function sanitizeExportName(name: string | null | undefined) {
	const sanitized = (name ?? "")
		.replace(/[<>:"/\\|?*]/g, "_")
		.split("")
		.map((character) => (character.charCodeAt(0) < 32 ? "_" : character))
		.join("")
		.replace(/^\.+/g, "")
		.replace(/\.+$/g, "")
		.replace(/\s+/g, " ")
		.trim();

	return sanitized || "Untitled";
}

export function createUniqueExportName(name: string, usedNames: Set<string>) {
	let candidate = name;
	let index = 1;

	while (usedNames.has(candidate.toLocaleLowerCase())) {
		candidate = `${name} (${index})`;
		index += 1;
	}

	usedNames.add(candidate.toLocaleLowerCase());
	return candidate;
}

async function renderWorkspaceDocumentPdf(
	env: Cloudflare.Env,
	kernel: WorkspaceKernelClient,
	item: WorkspaceItemSummary,
) {
	try {
		const checkpoint = await kernel.readDocumentCheckpoint({ itemId: item.id });
		const document = parseTiptapDocumentJson(checkpoint.content);
		const markdown = serializeTiptapDocumentToMarkdown(document);
		const html = await createDocumentExportHtml(item.name, markdown);

		return await renderHtmlToPdf(env, {
			fileName: gotenbergChromiumHtmlFileName,
			html,
			title: item.name,
		});
	} catch (error) {
		void recordWorkspaceExportFailure({
			error,
			event: "workspace_export_document",
			fields: {
				item_id: item.id,
				workspace_id: item.workspaceId,
			},
		});
		throw new Error("Unable to render a workspace document for export.");
	}
}

async function recordWorkspaceExportFailure(input: {
	error: unknown;
	event: string;
	fields: Record<string, string>;
}) {
	const { recordOperationalFailure } =
		await import("#/integrations/observability/operational-events");

	recordOperationalFailure(input);
}

async function renderHtmlToPdf(
	env: Cloudflare.Env,
	input: {
		fileName: string;
		html: string;
		title: string;
	},
): Promise<Uint8Array> {
	const converter = await getWorkspacePdfConverter(env);

	if (!converter) {
		return createFallbackTextPdf(extractTextFromHtml(input.html));
	}

	const convertedPdf = await renderHtmlWithWorkspacePdfConverter(converter, input).catch((error) => {
		void recordWorkspaceExportFailure({
			error,
			event: "workspace_export_pdf_converter",
			fields: {
				renderer: "office_pdf_converter",
			},
		});
		return null;
	});

	return convertedPdf ?? createFallbackTextPdf(extractTextFromHtml(input.html));
}

async function getWorkspacePdfConverter(env: Cloudflare.Env) {
	try {
		const { getRandom } = await import("@cloudflare/containers");
		return (await getRandom(
			env.OFFICE_PDF_CONVERTER,
			pdfConverterPoolSize,
		)) as WorkspacePdfConverter | null;
	} catch {
		return null;
	}
}

async function renderHtmlWithWorkspacePdfConverter(
	converter: WorkspacePdfConverter,
	input: {
		fileName: string;
		html: string;
	},
): Promise<Uint8Array> {
	const htmlBytes = textEncoder.encode(input.html);
	const multipart = createStreamingMultipartFile({
		body: new Blob([htmlBytes]).stream(),
		contentType: "text/html; charset=utf-8",
		fileName: input.fileName,
		formFieldName: "files",
		sizeBytes: htmlBytes.byteLength,
	});

	await Promise.resolve(
		converter.startAndWaitForPorts({
			cancellationOptions: {
				portReadyTimeoutMS: 60_000,
			},
		}),
	);

	const [response] = await Promise.all([
		converter.fetch(
			new Request(`http://office-pdf-converter${gotenbergChromiumHtmlPath}`, {
				body: multipart.body,
				duplex: "half",
				headers: { "content-type": multipart.contentType },
				method: "POST",
			} as RequestInit & { duplex: "half" }),
		),
		multipart.done,
	]);

	if (!response.ok) {
		throw new Error(`HTML to PDF conversion failed with status ${response.status}.`);
	}

	const sizedBody = requireSizedResponseBody(
		response,
		() => new Error("HTML to PDF conversion returned an empty PDF."),
	);

	return new Uint8Array(await new Response(sizedBody.body).arrayBuffer());
}

async function createDocumentExportHtml(title: string, markdown: string) {
	const body = await renderMarkdownToHtml(markdown);

	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: Letter; margin: 0.75in; }
body { color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.55; }
h1, h2, h3, h4, h5, h6 { break-after: avoid; line-height: 1.2; }
img, table, pre, blockquote, li { break-inside: avoid; }
pre { background: #f3f4f6; border-radius: 6px; overflow-wrap: anywhere; padding: 12px; white-space: pre-wrap; }
code { background: #f3f4f6; border-radius: 4px; padding: 1px 4px; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #d1d5db; padding: 6px 8px; }
blockquote { border-left: 3px solid #d1d5db; color: #4b5563; margin-left: 0; padding-left: 12px; }
</style>
</head>
<body>
<main class="workspace-document-prose">
${body}
</main>
</body>
</html>`;
}

async function renderMarkdownToHtml(markdown: string) {
	const [{ unified }, remarkParse, remarkGfm, remarkRehype, rehypeStringify] = await Promise.all([
		import("unified"),
		import("remark-parse"),
		import("remark-gfm"),
		import("remark-rehype"),
		import("rehype-stringify"),
	]);
	const file = await unified()
		.use(remarkParse.default)
		.use(remarkGfm.default)
		.use(remarkRehype.default)
		.use(rehypeStringify.default)
		.process(markdown);

	return String(file);
}

function createFallbackTextPdf(text: string) {
	const lines = text.split(/\r?\n/).flatMap((line) => wrapPdfLine(line, 88));
	const content = `BT
/F1 11 Tf
50 742 Td
14 TL
${lines.map((line) => `(${escapePdfText(line)}) Tj T*`).join("\n")}
ET`;
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
	];
	let pdf = "%PDF-1.4\n";
	const offsets = [0];

	for (const [index, object] of objects.entries()) {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}

	const xrefOffset = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets.slice(1)) {
		pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
	}
	pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

	return textEncoder.encode(pdf);
}

function replacePathBaseName(path: string, baseName: string) {
	const slashIndex = path.lastIndexOf("/");
	return slashIndex === -1 ? baseName : `${path.slice(0, slashIndex + 1)}${baseName}`;
}

function reserveUniqueZipPath(path: string, usedZipPaths: Set<string>) {
	const isDirectory = path.endsWith("/");
	const trimmedPath = isDirectory ? path.slice(0, -1) : path;
	const slashIndex = trimmedPath.lastIndexOf("/");
	const parentPath = slashIndex === -1 ? "" : trimmedPath.slice(0, slashIndex + 1);
	const baseName = slashIndex === -1 ? trimmedPath : trimmedPath.slice(slashIndex + 1);
	const extensionIndex = isDirectory ? -1 : baseName.lastIndexOf(".");
	const stem = extensionIndex > 0 ? baseName.slice(0, extensionIndex) : baseName;
	const extension = extensionIndex > 0 ? baseName.slice(extensionIndex) : "";
	let candidate = path;
	let index = 1;

	while (usedZipPaths.has(candidate.toLocaleLowerCase())) {
		candidate = `${parentPath}${stem} (${index})${extension}${isDirectory ? "/" : ""}`;
		index += 1;
	}

	usedZipPaths.add(candidate.toLocaleLowerCase());
	return candidate;
}

function stripExportExtension(path: string) {
	const slashIndex = path.lastIndexOf("/");
	const dotIndex = path.lastIndexOf(".");

	return dotIndex > slashIndex + 1 ? path.slice(0, dotIndex) : path;
}

function compareExportItems(left: WorkspaceItemSummary, right: WorkspaceItemSummary) {
	return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function extractTextFromHtml(html: string) {
	return html
		.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "\n")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "\n")
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "\n")
		.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "\n")
		.replace(/<[^>]+>/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function escapePdfText(value: string) {
	return Array.from(value.replace(/[\\()]/g, "\\$&"))
		.filter((character) => {
			const code = character.charCodeAt(0);
			return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
		})
		.join("");
}

function wrapPdfLine(line: string, width: number) {
	if (!line) {
		return [""];
	}

	const chunks: string[] = [];
	for (let index = 0; index < line.length; index += width) {
		chunks.push(line.slice(index, index + width));
	}

	return chunks;
}
