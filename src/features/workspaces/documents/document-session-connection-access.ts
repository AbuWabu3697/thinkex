import { createDbContext } from "#/db/server";
import { getWorkspaceMemberRole } from "#/features/workspaces/server/permissions";
import { getWorkspaceMemberCapabilities } from "#/features/workspaces/workspace-member-capabilities";
import { getSessionFromRequest } from "#/lib/auth-queries.server";

const documentSessionUserIdHeader = "x-thinkex-document-session-user-id";
const documentSessionCanMutateHeader = "x-thinkex-document-session-can-mutate";

export interface DocumentSessionConnectionState {
	canMutate: boolean;
	userId: string;
}

export type DocumentSessionConnectionAccess =
	| { status: "unauthenticated" }
	| { status: "forbidden" }
	| {
			status: "allowed";
			connectionState: DocumentSessionConnectionState;
	  };

export async function resolveDocumentSessionConnectionAccess(
	request: Request,
	workspaceId: string,
): Promise<DocumentSessionConnectionAccess> {
	const session = await getSessionFromRequest(request);

	if (!session?.user) {
		return { status: "unauthenticated" };
	}

	const dbContext = await createDbContext();

	try {
		const role = await getWorkspaceMemberRole(dbContext.db, {
			workspaceId,
			userId: session.user.id,
		});

		if (!role) {
			return { status: "forbidden" };
		}

		return {
			status: "allowed",
			connectionState: {
				userId: session.user.id,
				canMutate: getWorkspaceMemberCapabilities(role).canMutateContent,
			},
		};
	} finally {
		await dbContext.dispose();
	}
}

export function forwardDocumentSessionConnectionAccess(
	request: Request,
	connectionState: DocumentSessionConnectionState,
) {
	const headers = new Headers(request.headers);
	headers.set(documentSessionUserIdHeader, connectionState.userId);
	headers.set(documentSessionCanMutateHeader, connectionState.canMutate ? "true" : "false");

	return new Request(request, { headers });
}

export function readForwardedDocumentSessionConnectionAccess(
	request: Request,
): DocumentSessionConnectionState | null {
	const userId = request.headers.get(documentSessionUserIdHeader);
	const canMutate = request.headers.get(documentSessionCanMutateHeader);

	if (!userId || (canMutate !== "true" && canMutate !== "false")) {
		return null;
	}

	return {
		userId,
		canMutate: canMutate === "true",
	};
}
