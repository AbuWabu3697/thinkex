import { useQuery } from "@tanstack/react-query";
import { Check, LoaderCircle, Square, X } from "lucide-react";
import { useState } from "react";

import {
	CodeBlockActions,
	CodeBlockHeader,
	CodeBlockTitle,
} from "#/components/code-block/code-block-chrome";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "#/components/ui/dialog";
import type { AIThreadBrowserLiveViewTarget } from "#/features/workspaces/ai/ai-thread-browser";
import type { AiChatBrowserSessionController } from "#/features/workspaces/components/ai-chat/useWorkspaceAiBrowserSession";

const LIVE_VIEW_RETRY_MS = 15_000;
const LIVE_VIEW_MIN_REFRESH_MS = 30_000;
const LIVE_VIEW_FALLBACK_REFRESH_MS = 4 * 60 * 1000;

interface AiChatBrowserLiveViewState {
	error?: string;
	isFetching: boolean;
	refresh: () => void;
	targets: AIThreadBrowserLiveViewTarget[];
}

export function AiChatBrowserSessionCard({
	browser,
	isChatBusy,
	onStop,
}: {
	browser: AiChatBrowserSessionController;
	isChatBusy: boolean;
	onStop: () => void;
}) {
	const [open, setOpen] = useState(false);
	const isWaitingForUser = Boolean(browser.handoff);
	const liveViewQuery = useQuery({
		queryFn: browser.getLiveView,
		queryKey: ["workspace-ai-browser-live-view", browser.sessionKey],
		// Every fetch mints fresh signed Live View URLs, so a refresh swaps the
		// iframe's src and reloads it. That only costs something once someone is
		// interacting: refreshes stop when the expanded view is showing a live
		// tab, and nowhere else. The closed card's preview is non-interactive, so
		// reloading it wipes out nothing, and a handoff that outlives the URL's
		// expiry still has a working link when the person finally opens it. An
		// already-open Live View keeps streaming past the expiry, which only
		// gates opening the URL in the first place.
		refetchInterval: (query) => {
			const data = query.state.data;
			const hasTarget = Boolean(data?.targets.length);
			if (open && hasTarget) {
				return false;
			}

			return hasTarget ? getLiveViewRefreshMs(data?.expiresInMs) : LIVE_VIEW_RETRY_MS;
		},
		refetchOnWindowFocus: false,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const liveView: AiChatBrowserLiveViewState = {
		error: getLiveViewErrorMessage(liveViewQuery.error),
		isFetching: liveViewQuery.isFetching,
		refresh: () => {
			void liveViewQuery.refetch();
		},
		targets: liveViewQuery.data?.targets ?? [],
	};
	const liveTarget = getPreferredTarget(liveView.targets);
	const isConnecting = liveView.isFetching && !liveTarget;
	const copy = getBrowserCardCopy({
		handoffInstructions: browser.handoff?.instructions,
		hasLiveTarget: Boolean(liveTarget),
		isChatBusy,
		isConnecting,
	});

	if (!isChatBusy && !isWaitingForUser && liveViewQuery.isSuccess && !liveTarget) {
		return null;
	}

	return (
		<>
			<div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-xs">
				<div className="flex items-center">
					<button
						type="button"
						className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30"
						disabled={isConnecting}
						aria-label={
							isWaitingForUser
								? "Take control of browser"
								: liveTarget
									? "Open browser live view"
									: "Check browser connection"
						}
						onClick={() => {
							setOpen(true);
							if (!liveTarget) {
								liveView.refresh();
							}
						}}
					>
						<p className="min-w-0 truncate text-sm">
							<span className="font-medium">{copy.title}</span>
							<span className="text-muted-foreground"> · {copy.description}</span>
						</p>
						{(isConnecting || (isChatBusy && liveTarget)) && !isWaitingForUser ? (
							<LoaderCircle
								className="size-3.5 shrink-0 animate-spin text-muted-foreground"
								aria-hidden="true"
							/>
						) : null}
					</button>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="mr-2 text-muted-foreground"
						disabled={browser.isActing}
						aria-label="Stop browser"
						title="Stop browser"
						onClick={onStop}
					>
						<Square className="size-3 fill-current" aria-hidden="true" />
					</Button>
				</div>
				{liveTarget && !open ? (
					<div className="relative h-40 w-full overflow-hidden border-t bg-muted/20">
						<BrowserLiveViewFrame interactive={false} target={liveTarget} />
						<button
							type="button"
							className="absolute inset-0 outline-none transition-colors hover:bg-muted/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
							aria-label="Expand browser live view"
							onClick={() => setOpen(true)}
						/>
					</div>
				) : null}
				{browser.actionError ? (
					<p className="border-t bg-destructive/5 px-3 py-2 text-destructive text-xs">
						{browser.actionError}
					</p>
				) : null}
			</div>

			<AiChatBrowserLiveViewDialog
				browser={browser}
				liveView={liveView}
				open={open}
				onOpenChange={setOpen}
				onStop={() => {
					setOpen(false);
					onStop();
				}}
			/>
		</>
	);
}

function AiChatBrowserLiveViewDialog({
	browser,
	liveView,
	onOpenChange,
	onStop,
	open,
}: {
	browser: AiChatBrowserSessionController;
	liveView: AiChatBrowserLiveViewState;
	onOpenChange: (open: boolean) => void;
	onStop: () => void;
	open: boolean;
}) {
	const [selectedTargetId, setSelectedTargetId] = useState<string>();
	const { targets } = liveView;
	const selectedTarget =
		targets.find((target) => target.id === selectedTargetId) ?? getPreferredTarget(targets);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="fixed inset-0 top-0 left-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none"
				showCloseButton={false}
			>
				<CodeBlockHeader className="min-h-14 shrink-0 bg-background px-3 sm:px-4">
					<CodeBlockTitle className="min-w-0">
						<div className="min-w-0">
							<DialogTitle className="truncate text-sm leading-5">Browser live view</DialogTitle>
							<DialogDescription className="truncate text-xs leading-4">
								{browser.handoff?.instructions ??
									getBrowserTargetLabel(selectedTarget) ??
									"Interactive task browser"}
							</DialogDescription>
						</div>
					</CodeBlockTitle>
					<CodeBlockActions>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-muted-foreground"
							disabled={browser.isActing}
							onClick={onStop}
						>
							<Square className="size-3 fill-current" aria-hidden="true" />
							<span className="hidden sm:inline">Stop browser</span>
						</Button>
						<span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
						<DialogClose
							render={
								<Button type="button" variant="ghost" size="icon-sm" aria-label="Close live view" />
							}
						>
							<X className="size-4" aria-hidden="true" />
						</DialogClose>
					</CodeBlockActions>
				</CodeBlockHeader>

				{targets.length > 1 ? (
					<div
						className="flex shrink-0 gap-1 overflow-x-auto border-b bg-muted/30 px-3 py-1.5"
						role="group"
						aria-label="Browser tabs"
					>
						{targets.map((target, index) => (
							<Button
								key={target.id}
								type="button"
								variant={target.id === selectedTarget?.id ? "secondary" : "ghost"}
								size="xs"
								className="max-w-48 shrink-0"
								aria-pressed={target.id === selectedTarget?.id}
								onClick={() => setSelectedTargetId(target.id)}
							>
								<span className="truncate">
									{getBrowserTargetLabel(target) ?? `Tab ${index + 1}`}
								</span>
							</Button>
						))}
					</div>
				) : null}

				<div className="relative min-h-0 flex-1 bg-muted/20">
					{selectedTarget ? (
						<BrowserLiveViewFrame
							key={selectedTarget.liveViewUrl}
							interactive
							target={selectedTarget}
						/>
					) : (
						<LiveViewPlaceholder liveView={liveView} />
					)}
				</div>

				{browser.handoff ? (
					<div className="flex min-h-14 items-center justify-between gap-3 border-t bg-background px-3 py-2.5 sm:px-4">
						<p className="min-w-0 truncate text-muted-foreground text-xs">
							Complete the step above, then return control to the agent.
						</p>
						<div className="flex shrink-0 items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="gap-1.5"
								disabled={browser.isActing}
								onClick={() => {
									void browser.resolveHandoff(false).catch(() => undefined);
								}}
							>
								<X className="size-3.5" aria-hidden="true" />
								Couldn’t finish
							</Button>
							<Button
								type="button"
								size="sm"
								className="gap-1.5"
								disabled={browser.isActing}
								onClick={() => {
									void browser.resolveHandoff(true).catch(() => undefined);
								}}
							>
								<Check className="size-3.5" aria-hidden="true" />
								Done, continue
							</Button>
						</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function LiveViewPlaceholder({ liveView }: { liveView: AiChatBrowserLiveViewState }) {
	if (liveView.isFetching) {
		return (
			<div className="grid size-full place-items-center p-6 text-center">
				<div>
					<LoaderCircle
						className="mx-auto size-5 animate-spin text-muted-foreground"
						aria-hidden="true"
					/>
					<p className="mt-3 font-medium text-sm">Connecting to the browser…</p>
				</div>
			</div>
		);
	}

	return (
		<div className="grid size-full place-items-center p-6 text-center">
			<div className="max-w-sm">
				{liveView.error ? (
					<X className="mx-auto mb-3 size-5 text-destructive" aria-hidden="true" />
				) : null}
				<p className="font-medium text-sm">
					{liveView.error ? "Couldn’t open the live view" : "No browser tab yet"}
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					{liveView.error ?? "The agent may still be opening a page."}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-3"
					onClick={liveView.refresh}
				>
					{liveView.error ? "Try again" : "Refresh"}
				</Button>
			</div>
		</div>
	);
}

function BrowserLiveViewFrame({
	interactive,
	target,
}: {
	interactive: boolean;
	target: AIThreadBrowserLiveViewTarget;
}) {
	return (
		<iframe
			src={target.liveViewUrl}
			title={`${interactive ? "Browser Live View" : "Browser preview"} — ${getBrowserTargetLabel(target) ?? "active tab"}`}
			className={
				interactive
					? "size-full border-0 bg-background"
					: "pointer-events-none size-full border-0 bg-background"
			}
			allow="clipboard-read; clipboard-write"
			referrerPolicy="no-referrer"
			tabIndex={interactive ? undefined : -1}
		/>
	);
}

function getBrowserCardCopy(input: {
	handoffInstructions?: string;
	hasLiveTarget: boolean;
	isChatBusy: boolean;
	isConnecting: boolean;
}) {
	if (input.handoffInstructions) {
		return { title: "Browser needs you", description: input.handoffInstructions };
	}
	if (input.hasLiveTarget) {
		return input.isChatBusy
			? {
					title: "Browser is running",
					description: "Watch or take control while the agent works.",
				}
			: {
					title: "Browser is ready",
					description: "The interactive browser is still open.",
				};
	}
	if (input.isConnecting) {
		return {
			title: "Connecting to browser",
			description: "Connecting to the interactive browser.",
		};
	}
	return {
		title: "Browser unavailable",
		description: "The live session could not be reached.",
	};
}

/**
 * Refresh comfortably inside the URL's own lifetime rather than on a guessed
 * cadence — Browser Run mints Live View URLs with a ~5 minute default TTL and
 * reports it as `expiresInMs`.
 */
function getLiveViewRefreshMs(expiresInMs: number | undefined) {
	if (!expiresInMs || expiresInMs <= 0) {
		return LIVE_VIEW_FALLBACK_REFRESH_MS;
	}

	return Math.max(LIVE_VIEW_MIN_REFRESH_MS, Math.round(expiresInMs * 0.8));
}

function getLiveViewErrorMessage(error: unknown) {
	if (!error) {
		return undefined;
	}

	return error instanceof Error ? error.message : "Live View could not be opened.";
}

function getPreferredTarget<T extends AIThreadBrowserLiveViewTarget>(targets: T[]): T | undefined {
	for (let index = targets.length - 1; index >= 0; index -= 1) {
		const target = targets[index];
		if (target?.url) {
			return target;
		}
	}

	return targets.at(-1);
}

function getBrowserTargetLabel(target: AIThreadBrowserLiveViewTarget | undefined) {
	if (!target) {
		return undefined;
	}
	if (target.title && target.title !== target.url) {
		return target.title;
	}
	if (!target.url) {
		return undefined;
	}

	try {
		return new URL(target.url).hostname;
	} catch {
		return target.url;
	}
}
