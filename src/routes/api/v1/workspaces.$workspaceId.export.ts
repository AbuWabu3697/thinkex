import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, isNull } from "drizzle-orm";

import { workspaceMembers, workspaces } from "#/db/schema";
import { createDbContext } from "#/db/server";
import { exportWorkspaceToZip } from "#/features/workspaces/export/workspace-export";
import {
	getWorkspaceKernelFromEnv,
	type WorkspaceKernelClient,
} from "#/features/workspaces/kernel/workspace-kernel-access";
import { mapWorkspaceDetailRow } from "#/features/workspaces/server/mappers";
import { WorkspaceForbiddenError } from "#/features/workspaces/server/permissions";
import { apiError, apiFailure, getRequestId } from "#/lib/api/http";
import { getSessionFromRequest } from "#/lib/auth-queries.server";

async function handleWorkspaceExport(request: Request, workspaceId: string) {
	const requestId = getRequestId(request);

	try {
		const session = await getSessionFromRequest(request);

		if (!session) {
			return apiError(
				requestId,
				401,
				"UNAUTHORIZED",
				"You must be signed in to export workspaces.",
			);
		}

		const { kernel, page } = await getExportWorkspacePage({
			workspaceId,
			userId: session.user.id,
		});
		const archive = await exportWorkspaceToZip({
			env,
			kernel,
			page,
			userId: session.user.id,
		});

		return new Response(toResponseBody(archive.body), {
			headers: {
				"cache-control": "no-store",
				"content-disposition": `attachment; filename="${sanitizeHeaderFileName(archive.fileName)}"`,
				"content-length": String(archive.body.byteLength),
				"content-type": "application/zip",
				"x-request-id": requestId,
			},
		});
	} catch (error) {
		if (error instanceof WorkspaceForbiddenError) {
			return apiError(
				requestId,
				403,
				"FORBIDDEN",
				"You do not have permission to export this workspace.",
			);
		}

		if (error instanceof WorkspaceNotFoundError) {
			return apiError(requestId, 404, "WORKSPACE_NOT_FOUND", "Workspace not found.");
		}

		return apiFailure({
			cause: error,
			code: "WORKSPACE_EXPORT_FAILED",
			fields: { workspace_id: workspaceId },
			message: "Unable to export this workspace right now.",
			request,
			requestId,
			status: 500,
		});
	}
}

async function getExportWorkspacePage(input: { workspaceId: string; userId: string }): Promise<{
	kernel: WorkspaceKernelClient;
	page: Parameters<typeof exportWorkspaceToZip>[0]["page"];
}> {
	const dbContext = await createDbContext();

	try {
		const [workspaceRow] = await dbContext.db
			.select({
				lastOpenedAt: workspaceMembers.lastOpenedAt,
				membershipRole: workspaceMembers.role,
				workspace: workspaces,
			})
			.from(workspaceMembers)
			.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
			.where(
				and(
					eq(workspaceMembers.workspaceId, input.workspaceId),
					eq(workspaceMembers.userId, input.userId),
					isNull(workspaces.archivedAt),
				),
			)
			.limit(1);

		if (!workspaceRow) {
			throw new WorkspaceNotFoundError();
		}

		const workspace = mapWorkspaceDetailRow(
			{
				...workspaceRow.workspace,
				lastOpenedAt: workspaceRow.lastOpenedAt,
			},
			workspaceRow.membershipRole,
		);
		const kernel = await getWorkspaceKernelFromEnv(env, input.workspaceId);
		const page = await kernel.getPage();

		return {
			kernel,
			page: {
				workspace,
				items: page.items,
				itemFacts: page.itemFacts,
				revision: page.revision,
			},
		};
	} finally {
		await dbContext.dispose();
	}
}

class WorkspaceNotFoundError extends Error {
	constructor() {
		super("Workspace not found.");
		this.name = "WorkspaceNotFoundError";
	}
}

function sanitizeHeaderFileName(fileName: string) {
	return fileName.replace(/["\r\n\\]/g, "_");
}

function toResponseBody(bytes: Uint8Array) {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

export const Route = createFileRoute("/api/v1/workspaces/$workspaceId/export")({
	server: {
		handlers: {
			GET: ({ params, request }) => handleWorkspaceExport(request, params.workspaceId),
		},
	},
});

export { handleWorkspaceExport };
