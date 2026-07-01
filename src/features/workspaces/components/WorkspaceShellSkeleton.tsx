import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import ThinkExLogo from "#/components/ThinkExLogo";
import { Skeleton } from "#/components/ui/skeleton";
import AiChatThreadSkeleton from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import WorkspaceCardSkeleton from "#/features/workspaces/components/WorkspaceCardSkeleton";
import WorkspaceChatLayout from "#/features/workspaces/components/WorkspaceChatLayout";
import WorkspaceFrame from "#/features/workspaces/components/WorkspaceFrame";
import { defaultWorkspaceUiSession } from "#/features/workspaces/model/workspace-ui";
import { workspaceToolbarButtonSizeClass } from "#/features/workspaces/components/workspace-toolbar-styles";
import type { WorkspaceAiChatSurfaceMode } from "#/features/workspaces/state/workspace-ui-store";
import { cn } from "#/lib/utils";

const workspaceSkeletonCardKeys = [
	"card-1",
	"card-2",
	"card-3",
	"card-4",
	"card-5",
	"card-6",
	"card-7",
] as const;

interface WorkspaceShellSkeletonProps {
	chatSurfaceMode?: WorkspaceAiChatSurfaceMode;
}

export default function WorkspaceShellSkeleton({
	chatSurfaceMode = defaultWorkspaceUiSession.chatSurfaceMode,
}: WorkspaceShellSkeletonProps) {
	const mobileChatSurfaceMode = chatSurfaceMode === "docked" ? "hidden" : chatSurfaceMode;

	return (
		<>
			<div className="h-dvh sm:hidden">
				<WorkspaceMobileShellSkeleton chatSurfaceMode={mobileChatSurfaceMode} />
			</div>
			<div className="hidden sm:block">
				<WorkspaceChatLayout
					chatSurfaceMode={chatSurfaceMode}
					chrome={<WorkspaceSkeletonChrome />}
					content={<WorkspaceSkeletonContent />}
					chatPanel={chatSurfaceMode === "hidden" ? undefined : <WorkspaceSkeletonAiChatPanel />}
				/>
			</div>
		</>
	);
}

function WorkspaceMobileShellSkeleton({
	chatSurfaceMode,
}: {
	chatSurfaceMode: WorkspaceAiChatSurfaceMode;
}) {
	const isChatOpen = chatSurfaceMode !== "hidden";

	return (
		<div data-app-shell className="relative h-dvh overflow-hidden bg-background text-foreground">
			<WorkspaceFrame
				chrome={<WorkspaceMobileSkeletonChrome />}
				content={<WorkspaceMobileSkeletonContent />}
			/>
			{isChatOpen ? (
				<div className="fixed inset-0 z-50 h-dvh w-dvw bg-background">
					<WorkspaceSkeletonAiChatPanel />
				</div>
			) : null}
		</div>
	);
}

export function WorkspaceSkeletonChrome() {
	return (
		<header className="sticky top-0 z-40 bg-muted">
			<div className="flex h-12 w-full items-stretch justify-between gap-3 px-4">
				<div className="flex min-w-0 flex-1 items-stretch gap-4">
					<Link
						to="/home"
						preload="intent"
						className="flex shrink-0 items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">ThinkEx</span>
					</Link>
					<div className="flex min-w-0 flex-1 items-center gap-1 px-1">
						<Skeleton className="h-8 w-32 rounded-md" />
						<Skeleton className="h-4 w-px shrink-0 rounded-none" />
						<Skeleton className="h-8 w-28 rounded-md" />
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-full")} />
				</div>
			</div>
			<WorkspaceContextBarSkeleton />
		</header>
	);
}

function WorkspaceMobileSkeletonChrome() {
	return (
		<header className="sticky top-0 z-40 bg-muted">
			<div className="flex h-12 w-full items-stretch justify-between gap-3 px-4">
				<Link
					to="/home"
					preload="intent"
					className="flex shrink-0 items-center rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label="Back to workspaces"
				>
					<ThinkExLogo size={28} />
				</Link>
				<div className="flex shrink-0 items-center gap-2">
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-full")} />
					<div className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-muted-foreground text-sm shadow-xs">
						<MessageSquare className="size-4" aria-hidden="true" />
						<Skeleton className="h-3.5 w-8 rounded-sm" />
					</div>
				</div>
			</div>
			<WorkspaceMobileContextBarSkeleton />
		</header>
	);
}

function WorkspaceContextBarSkeleton() {
	return (
		<div className="flex h-11 items-center justify-between gap-3 bg-background px-4 text-sm">
			<div className="flex min-w-0 items-center gap-1.5">
				<Skeleton className="size-3.5 rounded-sm" />
				<Skeleton className="h-4 w-36 rounded-sm" />
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<Skeleton className="h-8.5 w-20 rounded-md" />
				<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
			</div>
		</div>
	);
}

function WorkspaceMobileContextBarSkeleton() {
	return (
		<div className="flex h-11 items-center justify-between gap-3 bg-background px-4 text-sm">
			<div className="flex min-w-0 items-center gap-1.5">
				<Skeleton className="size-3.5 rounded-sm" />
				<Skeleton className="h-4 w-28 rounded-sm" />
			</div>
			<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
		</div>
	);
}

export function WorkspaceSkeletonContent() {
	return (
		<div className="h-full min-h-0 overflow-hidden">
			<div className="space-y-5 px-4 py-3">
				<section className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-5">
					{workspaceSkeletonCardKeys.map((key) => (
						<WorkspaceCardSkeleton key={key} />
					))}
				</section>
			</div>
		</div>
	);
}

function WorkspaceMobileSkeletonContent() {
	return (
		<div className="h-full min-h-0 overflow-hidden">
			<div className="space-y-3 px-4 py-3">
				{workspaceSkeletonCardKeys.slice(0, 5).map((key) => (
					<div
						key={key}
						className="flex h-24 items-center gap-4 rounded-xl border border-border/70 bg-card/80 p-3"
					>
						<Skeleton className="size-14 shrink-0 rounded-lg" />
						<div className="min-w-0 flex-1 space-y-2">
							<Skeleton className="h-4 w-2/3 rounded-sm" />
							<Skeleton className="h-3.5 w-1/2 rounded-sm" />
						</div>
						<div className="flex items-center gap-2">
							<Skeleton className="size-8 rounded-md" />
							<Skeleton className="size-8 rounded-md" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export function WorkspaceSkeletonAiChatPanel() {
	return (
		<aside className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-md border border-border/70 bg-background/95 p-1 shadow-sm backdrop-blur">
				<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
				<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
				<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
			</div>
			<div className="px-4 pt-14">
				<AiChatThreadSkeleton />
			</div>
		</aside>
	);
}
