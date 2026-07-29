import {
	getDocumentSessionRoomName,
	getDocumentSessionRouteParams,
	isDocumentSessionRequestPath,
} from "#/features/workspaces/agent-routes";
import {
	forwardDocumentSessionConnectionAccess,
	resolveDocumentSessionConnectionAccess,
} from "#/features/workspaces/documents/document-session-connection-access";
import { WorkspaceAuthError } from "#/features/workspaces/server/permissions";
import { recordOperationalFailure } from "#/integrations/observability/operational-events";
import { getTelemetryRequestDetails } from "#/integrations/posthog/server-context";

export async function routeDocumentSessionRequest(request: Request, env: Env) {
	const url = new URL(request.url);

	if (!isDocumentSessionRequestPath(url.pathname)) {
		return null;
	}

	const params = getDocumentSessionRouteParams(url.pathname);

	if (!params) {
		return new Response("Document session not found", { status: 404 });
	}

	try {
		const access = await resolveDocumentSessionConnectionAccess(request, params.workspaceId);

		if (access.status === "unauthenticated") {
			return new Response("Unauthorized", { status: 401 });
		}

		if (access.status === "forbidden") {
			return new Response("Forbidden", { status: 403 });
		}

		const documentSession = env.DocumentSession.getByName(getDocumentSessionRoomName(params));

		return documentSession.fetch(
			forwardDocumentSessionConnectionAccess(request, access.connectionState),
		);
	} catch (error) {
		if (error instanceof WorkspaceAuthError) {
			return new Response("Unauthorized", { status: 401 });
		}

		recordOperationalFailure({
			error,
			event: "document_session_route",
			fields: {
				status_code: 503,
				workspace_id: params.workspaceId,
			},
			request: getTelemetryRequestDetails(request, "document_session_route"),
		});
		return new Response("Document session unavailable", { status: 503 });
	}
}
