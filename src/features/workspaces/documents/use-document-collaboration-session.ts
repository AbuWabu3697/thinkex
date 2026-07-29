import { useCallback, useSyncExternalStore } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-partyserver/provider";
import * as Y from "yjs";

import { getDocumentSessionBaseUrl } from "#/features/workspaces/agent-routes";
import { getCollaborationUserColor } from "#/lib/design-system-colors";

const localDocumentReadyKey = "server-synced";
const localDocumentReadyValue = "true";
const localDocumentStorePrefix = "thinkex-document";

interface DocumentCollaborationUser {
	id: string;
	image?: string | null;
	name: string;
}

export interface DocumentCollaborationSession {
	provider: WebsocketProvider;
	ydoc: Y.Doc;
}

interface ActiveDocumentCollaborationSession {
	destroy(): void;
	key: string;
	persistence: IndexeddbPersistence;
	provider: WebsocketProvider;
	publicSession: DocumentCollaborationSession | null;
	ready: boolean;
	refs: number;
	subscribe(listener: () => void): () => void;
	subscribers: Set<() => void>;
	ydoc: Y.Doc;
}

const activeDocumentSessions = new Map<string, ActiveDocumentCollaborationSession>();

export function useDocumentCollaborationSession(input: {
	itemId: string;
	userId: string | null;
	userImage?: string | null;
	userName: string | null;
	workspaceId: string;
}) {
	const { itemId, userId, userImage, userName, workspaceId } = input;
	const sessionKey =
		userId && userName ? getDocumentSessionKey({ itemId, userId, workspaceId }) : null;

	const subscribe = useCallback(
		(listener: () => void) => {
			if (!userId || !userName) {
				return () => {};
			}

			const activeSession = acquireDocumentSession({
				itemId,
				user: {
					id: userId,
					image: userImage ?? null,
					name: userName,
				},
				workspaceId,
			});
			const unsubscribe = activeSession.subscribe(listener);

			queueMicrotask(listener);

			return () => {
				unsubscribe();
				releaseDocumentSession(activeSession);
			};
		},
		[itemId, userId, userImage, userName, workspaceId],
	);

	const getSnapshot = useCallback(
		() => (sessionKey ? (activeDocumentSessions.get(sessionKey)?.publicSession ?? null) : null),
		[sessionKey],
	);

	return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

function acquireDocumentSession(input: {
	itemId: string;
	user: DocumentCollaborationUser;
	workspaceId: string;
}) {
	const key = getDocumentSessionKey({
		itemId: input.itemId,
		userId: input.user.id,
		workspaceId: input.workspaceId,
	});
	const activeSession = activeDocumentSessions.get(key);

	if (activeSession) {
		activeSession.refs += 1;
		activeSession.provider.awareness.setLocalStateField("user", getCollaborationUser(input.user));
		return activeSession;
	}

	const ydoc = new Y.Doc();
	const persistence = new IndexeddbPersistence(
		getDocumentLocalStoreName({
			itemId: input.itemId,
			userId: input.user.id,
			workspaceId: input.workspaceId,
		}),
		ydoc,
	);
	const provider = new WebsocketProvider(
		getDocumentSessionBaseUrl(input.workspaceId),
		encodeURIComponent(input.itemId),
		ydoc,
		{
			disableBc: true,
			resyncInterval: 10_000,
		},
	);
	const session = createActiveDocumentSession({
		key,
		persistence,
		provider,
		ydoc,
	});

	provider.awareness.setLocalStateField("user", getCollaborationUser(input.user));
	activeDocumentSessions.set(key, session);

	return session;
}

function createActiveDocumentSession(input: {
	key: string;
	persistence: IndexeddbPersistence;
	provider: WebsocketProvider;
	ydoc: Y.Doc;
}): ActiveDocumentCollaborationSession {
	const session: ActiveDocumentCollaborationSession = {
		destroy() {
			input.provider.off("sync", handleSync);
			void input.persistence.destroy();
			input.provider.destroy();
			input.ydoc.destroy();
			activeDocumentSessions.delete(input.key);
		},
		key: input.key,
		persistence: input.persistence,
		provider: input.provider,
		publicSession: null,
		ready: input.provider.synced,
		refs: 1,
		subscribe(listener: () => void) {
			session.subscribers.add(listener);
			return () => {
				session.subscribers.delete(listener);
			};
		},
		subscribers: new Set<() => void>(),
		ydoc: input.ydoc,
	};

	const markReady = () => {
		if (session.ready) {
			return;
		}

		session.ready = true;
		session.publicSession = {
			provider: session.provider,
			ydoc: session.ydoc,
		};
		notifyDocumentSessionSubscribers(session);
	};
	/**
	 * Persistence is an optimization, so a failed write must stay silent rather
	 * than surfacing as an unhandled rejection on every sync — IndexedDB is
	 * unavailable in private windows and can be over quota anywhere.
	 */
	const rememberServerSync = () => {
		void session.persistence.set(localDocumentReadyKey, localDocumentReadyValue).catch(() => {
			// The live collaboration session remains canonical.
		});
	};
	const handleSync = (synced: boolean) => {
		if (!synced) {
			return;
		}

		rememberServerSync();
		markReady();
	};

	if (session.ready) {
		session.publicSession = {
			provider: session.provider,
			ydoc: session.ydoc,
		};
		rememberServerSync();
	}

	void session.persistence.whenSynced
		.then(() => session.persistence.get(localDocumentReadyKey))
		.then((wasServerSynced) => {
			if (wasServerSynced === localDocumentReadyValue) {
				markReady();
			}
		})
		.catch(() => {
			// IndexedDB is an optimization. The live collaboration session remains canonical.
		});

	input.provider.on("sync", handleSync);

	return session;
}

function releaseDocumentSession(session: ActiveDocumentCollaborationSession) {
	session.refs = Math.max(0, session.refs - 1);

	if (session.refs > 0) {
		return;
	}

	session.provider.awareness.setLocalState(null);
	queueMicrotask(() => {
		if (session.refs === 0) {
			session.destroy();
		}
	});
}

function notifyDocumentSessionSubscribers(
	session: Pick<ActiveDocumentCollaborationSession, "subscribers">,
) {
	for (const subscriber of session.subscribers) {
		subscriber();
	}
}

function getDocumentSessionKey(input: { itemId: string; userId: string; workspaceId: string }) {
	return `${input.userId}:${input.workspaceId}:${input.itemId}`;
}

function getDocumentLocalStoreName(input: { itemId: string; userId: string; workspaceId: string }) {
	return `${localDocumentStorePrefix}:${getDocumentSessionKey(input)}`;
}

function getCollaborationUser(user: DocumentCollaborationUser) {
	return {
		id: user.id,
		name: user.name || "User",
		image: user.image ?? null,
		color: getCollaborationUserColor(user.id),
	};
}
