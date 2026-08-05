import { apiErrorSchema } from "#/lib/api/contracts";

export async function downloadWorkspaceDocumentPdf(input: {
	documentPath: string;
	itemId: string;
	workspaceId: string;
}) {
	const response = await fetch(
		`/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/documents/${encodeURIComponent(input.itemId)}/pdf`,
	);
	if (!response.ok) {
		throw await getExportError(response);
	}

	const objectUrl = URL.createObjectURL(await response.blob());
	const anchor = document.createElement("a");
	anchor.href = objectUrl;
	anchor.download = getPdfFileName(input.documentPath);
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(objectUrl);
}

function getPdfFileName(documentPath: string) {
	const name = documentPath.split("/").filter(Boolean).at(-1)?.trim() || "Document";
	return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

async function getExportError(response: Response) {
	const fallback = "Unable to export this document as PDF.";
	try {
		const payload = apiErrorSchema.safeParse(await response.json());
		return new Error(payload.success ? payload.data.message : fallback);
	} catch {
		return new Error(fallback);
	}
}
