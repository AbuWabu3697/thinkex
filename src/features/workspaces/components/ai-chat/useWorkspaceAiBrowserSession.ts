import { useMutation, useQuery } from "@tanstack/react-query";

import type {
	AIThreadBrowserHandoff,
	AIThreadBrowserLiveView,
	AIThreadBrowserState,
} from "#/features/workspaces/ai/ai-thread-browser";

const BROWSER_SESSION_POLL_MS = 1_500;

interface WorkspaceAiAgent {
	call<T = unknown>(method: string, args?: unknown[]): Promise<T>;
	ready: Promise<void>;
}

export interface AiChatBrowserSessionController {
	actionError?: string;
	getLiveView: () => Promise<AIThreadBrowserLiveView | null>;
	hasSession: boolean;
	handoff?: AIThreadBrowserHandoff;
	isActing: boolean;
	resolveHandoff: (approved: boolean) => Promise<void>;
	sessionKey: string;
	stopBrowser: () => Promise<void>;
}

export function useWorkspaceAiBrowserSession(input: {
	agent: WorkspaceAiAgent;
	isChatBusy: boolean;
	threadId: string;
}): AiChatBrowserSessionController {
	const stateQuery = useQuery({
		queryFn: async () => {
			await input.agent.ready;
			return input.agent.call<AIThreadBrowserState>("getBrowserState");
		},
		queryKey: ["workspace-ai-browser-state", input.threadId],
		// A pending handoff outlives the turn that raised it — the run parks and
		// the chat goes idle — so an open session or handoff keeps the poll alive
		// on its own.
		refetchInterval: (query) =>
			input.isChatBusy || query.state.data?.presence || query.state.data?.handoff
				? BROWSER_SESSION_POLL_MS
				: false,
		retry: false,
	});
	const action = useMutation({
		mutationFn: async (
			request:
				| { executionId?: string; kind: "stop" }
				| { approved: boolean; executionId: string; kind: "resolve" },
		) => {
			if (request.kind === "resolve") {
				await input.agent.call("resolveBrowserHandoff", [request.executionId, request.approved]);
				return;
			}

			await input.agent.call(
				"stopBrowserSession",
				request.executionId ? [request.executionId] : [],
			);
		},
		onSettled: async () => {
			await stateQuery.refetch();
		},
	});
	const handoff = stateQuery.data?.handoff ?? undefined;
	const presence = stateQuery.data?.presence;

	return {
		actionError: action.error instanceof Error ? action.error.message : undefined,
		getLiveView: () => input.agent.call<AIThreadBrowserLiveView | null>("getBrowserLiveView"),
		hasSession: Boolean(presence),
		handoff,
		isActing: action.isPending,
		resolveHandoff: async (approved) => {
			if (!handoff) {
				return;
			}

			await action.mutateAsync({
				approved,
				executionId: handoff.executionId,
				kind: "resolve",
			});
		},
		sessionKey: `${input.threadId}:${presence?.startedAt ?? "none"}`,
		stopBrowser: async () => {
			await action.mutateAsync({
				executionId: handoff?.executionId,
				kind: "stop",
			});
		},
	};
}
