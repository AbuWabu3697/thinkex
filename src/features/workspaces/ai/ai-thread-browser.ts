import type { PendingAction } from "@cloudflare/codemode";
import {
	BrowserConnector,
	DurableBrowserSessionStore,
	type BrowserBinding,
	type BrowserConnectorSessionOptions,
} from "agents/browser";
import { z } from "zod";

import { defineAIThreadTool } from "#/features/workspaces/ai/ai-thread-tool";

export const AI_THREAD_BROWSER_HANDOFF_TOOL_NAME = "browser_handoff";
/** The namespace `AIThreadToolSetConnector` publishes first-party tools under. */
const AI_THREAD_TOOL_CONNECTOR_NAME = "tools";
const AI_THREAD_BROWSER_KEEP_ALIVE_MS = 10 * 60 * 1000;
const AI_THREAD_BROWSER_SESSION_KEY = "task";
/**
 * `agents` files the shared session under `cdp:reuse:<key>`. Presence reads
 * that record directly instead of calling `sessionInfo()`, which would spend a
 * Browser Run round trip on every poll — at the cost of depending on a prefix
 * the library keeps private, so keep the key half derived from the options
 * that produce it.
 */
const AI_THREAD_BROWSER_STORE_KEY = `cdp:reuse:${AI_THREAD_BROWSER_SESSION_KEY}`;
const MODEL_HIDDEN_BROWSER_TOOLS = new Set([
	"closeSession",
	"getLiveViewUrl",
	"sessionInfo",
	"startSession",
]);

/**
 * The single model-facing browser contract.
 *
 * Both the top-level orchestration tool and the lazily discovered CDP
 * connector reuse this list so browser behavior cannot drift depending on
 * whether the model has inspected the connector yet.
 */
/**
 * What the model must know *before* it decides to reach for a browser at all:
 * when browsing is the right tool, and the rules it cannot violate once it is.
 * This is the only browser text carried in the always-on orchestrate
 * description, so it stays short — every turn pays for it, including the ones
 * that never open a page.
 */
export const AI_THREAD_BROWSER_POLICY = [
	"Use web search and page-reading tools for simple research. Use `cdp.*` only for rendered interaction, JavaScript applications, screenshots, or authenticated work.",
	"Navigate only public HTTP(S) pages. Never navigate to localhost, private or link-local IP addresses, or internal-only hostnames.",
	"For login, MFA, CAPTCHA, private input, payments, external publishing or sending, destructive deletion, and account or security changes, open the exact page and call tools.browser_handoff({ instructions }) before the consequential step. Calling it is mandatory — a chat message saying you paused does not pause the run.",
	"Never ask the user to put credentials or private form values in chat. They enter them only in Browser Live View.",
	"ThinkEx owns browser session lifecycle and Live View. Never request, return, or mention a Live View URL, browser session ID, target handle, JWT, or WebSocket URL.",
] as const;

/**
 * How to actually drive CDP. Only reaches the model through the connector's
 * own instructions, which it reads on discovery — the point at which it is
 * already writing browser code and these details start to matter.
 */
const AI_THREAD_BROWSER_MECHANICS = [
	"Issue CDP calls sequentially. Never run them with Promise.all.",
	"Browser- and Target-scoped commands need no sessionId; page-scoped commands require the stable handle from cdp.attachToTarget({ targetId }).",
	"There is no cdp.newTab. Open a tab with Target.createTarget, then attach before any page-scoped command.",
	"The CDP namespace is request/response only: use cdp.send, cdp.attachToTarget, cdp.spec, and the debug-log helpers. It has no cdp.on, cdp.off, or event-subscription API.",
	"Never wait for CDP events. When page readiness matters, poll document.readyState with sequential Runtime.evaluate calls.",
	"Do not use saved snippets or codemode.run for browser work. Issue CDP calls directly in the current execution so the target and session are live when a handoff pauses.",
	"If the shared browser session is disconnected or a CDP command fails because the session is gone, call cdp.resetSession() once and retry the failed operation. Do not repeatedly reset a healthy session.",
	"Start with one tab, close tabs you no longer need, and keep at most five tabs open.",
] as const;

const AI_THREAD_BROWSER_SESSION_OPTIONS = {
	mode: "reuse",
	key: AI_THREAD_BROWSER_SESSION_KEY,
	keepAliveMs: AI_THREAD_BROWSER_KEEP_ALIVE_MS,
	recording: false,
} as const satisfies BrowserConnectorSessionOptions;

export interface AIThreadBrowserLiveViewTarget {
	id: string;
	liveViewUrl: string;
	title?: string;
	url?: string;
}

export interface AIThreadBrowserLiveView {
	expiresInMs: number;
	targets: AIThreadBrowserLiveViewTarget[];
}

export interface AIThreadBrowserPresence {
	startedAt: number;
}

export interface AIThreadBrowserHandoff {
	executionId: string;
	instructions: string;
}

export interface AIThreadBrowserState {
	handoff: AIThreadBrowserHandoff | null;
	presence: AIThreadBrowserPresence | null;
}

const browserHandoffInputSchema = z.object({
	instructions: z
		.string()
		.trim()
		.min(1)
		.max(500)
		.describe("What the user must complete in the open browser before the agent resumes."),
});

const browserHandoffOutputSchema = z.object({
	resumed: z.literal(true),
});

export function createAIThreadBrowserConnector(ctx: DurableObjectState, browser: BrowserBinding) {
	return new AIThreadBrowserConnector(ctx, {
		browser,
		store: new DurableBrowserSessionStore(ctx.storage),
		session: AI_THREAD_BROWSER_SESSION_OPTIONS,
	});
}

class AIThreadBrowserConnector extends BrowserConnector {
	protected override instructions() {
		// Discovery is the moment of use, so repeat the policy here alongside the
		// mechanics: it costs nothing on turns that never open a browser, and the
		// rules matter most immediately before the model writes CDP calls.
		return [...AI_THREAD_BROWSER_POLICY, ...AI_THREAD_BROWSER_MECHANICS].join("\n");
	}

	protected override tools() {
		return Object.fromEntries(
			Object.entries(super.tools()).filter(([name]) => !MODEL_HIDDEN_BROWSER_TOOLS.has(name)),
		);
	}
}

export function createAIThreadBrowserHandoffTool() {
	return defineAIThreadTool({
		description:
			"Pause browser automation so the user can take control in Live View. Call only after opening the exact page that needs login, MFA, CAPTCHA, private input, or confirmation of a consequential final action.",
		inputSchema: browserHandoffInputSchema,
		outputSchema: browserHandoffOutputSchema,
		needsApproval: true,
		strict: true,
		execute: async () => ({ resumed: true }),
	});
}

/**
 * Narrow the runtime's pending actions to the one the chat can resolve.
 *
 * Deliberately server-side: `PendingAction.args` is untruncated, so handing the
 * raw list to the client would ship every approval-gated tool's arguments to
 * the browser on a 1.5s poll just to read one instruction string.
 */
export function getAIThreadBrowserHandoff(
	pending: readonly PendingAction[],
): AIThreadBrowserHandoff | null {
	const action = pending.find(
		(candidate) =>
			candidate.connector === AI_THREAD_TOOL_CONNECTOR_NAME &&
			candidate.method === AI_THREAD_BROWSER_HANDOFF_TOOL_NAME,
	);

	if (!action) {
		return null;
	}

	return {
		executionId: action.executionId,
		instructions: getBrowserHandoffInstructions(action.args),
	};
}

function getBrowserHandoffInstructions(args: unknown) {
	const fallback = "Complete the requested step in the browser.";
	if (!args || typeof args !== "object" || !("instructions" in args)) {
		return fallback;
	}

	const instructions = args.instructions;
	return typeof instructions === "string" && instructions.trim() ? instructions.trim() : fallback;
}

export async function getAIThreadBrowserPresence(
	storage: DurableObjectStorage,
): Promise<AIThreadBrowserPresence | null> {
	const store = new DurableBrowserSessionStore(storage);
	const session = await store.get(AI_THREAD_BROWSER_STORE_KEY);
	if (!session) {
		return null;
	}

	if (Date.now() - session.updatedAt >= AI_THREAD_BROWSER_KEEP_ALIVE_MS) {
		await store.delete(AI_THREAD_BROWSER_STORE_KEY);
		return null;
	}

	return { startedAt: session.createdAt };
}

export async function getAIThreadBrowserLiveView(
	connector: BrowserConnector,
): Promise<AIThreadBrowserLiveView | null> {
	const liveView = await connector.liveView({ mode: "tab" });
	if (!liveView) {
		return null;
	}

	return {
		expiresInMs: liveView.expiresInMs,
		targets: liveView.targets.filter(isBrowserPageTarget).map((target) => ({
			id: target.targetId,
			liveViewUrl: target.url,
			...(target.title ? { title: target.title } : {}),
			...(isDisplayableBrowserUrl(target.pageUrl) ? { url: target.pageUrl } : {}),
		})),
	};
}

function isBrowserPageTarget(target: { type?: string }) {
	return target.type === undefined || target.type === "page";
}

function isDisplayableBrowserUrl(url: string | undefined): url is string {
	return Boolean(url && !url.startsWith("about:") && !url.startsWith("chrome:"));
}
