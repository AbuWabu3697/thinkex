import { getServerByName } from "partyserver";

import { getDocumentSessionRoomName } from "#/features/workspaces/agent-routes";

export function getDocumentSessionFromEnv(
	env: Cloudflare.Env,
	input: { itemId: string; workspaceId: string },
) {
	return getServerByName(env.DocumentSession, getDocumentSessionRoomName(input));
}

export function getDocumentSessionForDeletionFromEnv(
	env: Cloudflare.Env,
	input: { itemId: string; workspaceId: string },
) {
	// Deletion must not initialize Yjs: onLoad may try to hydrate from the
	// kernel after the item has already been marked deleted.
	return env.DocumentSession.getByName(getDocumentSessionRoomName(input));
}
