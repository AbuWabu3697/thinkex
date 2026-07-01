import { MessageSquare } from "lucide-react";

import { Skeleton } from "#/components/ui/skeleton";
import AiChatThreadSkeleton from "#/features/workspaces/components/ai-chat/AiChatThreadSkeleton";
import WorkspaceCardSkeleton from "#/features/workspaces/components/WorkspaceCardSkeleton";
import WorkspaceChatLayout from "#/features/workspaces/components/WorkspaceChatLayout";
import WorkspaceHeaderChrome from "#/features/workspaces/components/WorkspaceHeaderChrome";
import WorkspaceMobileFrame from "#/features/workspaces/components/WorkspaceMobileFrame";
import {
	defaultWorkspaceUiSession,
	getWorkspaceMobileChatSurfaceMode,
	type WorkspaceMobileChatSurfaceMode,
} from "#/features/workspaces/model/workspace-ui";
import {
	workspaceToolbarButtonSizeClass,
	workspaceToolbarTextButtonClass,
} from "#/features/workspaces/components/workspace-toolbar-styles";
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
	const mobileChatSurfaceMode = getWorkspaceMobileChatSurfaceMode(chatSurfaceMode);

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

export function WorkspaceSkeletonChrome() {
	return (
		<WorkspaceHeaderChrome
			actions={
				<>
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-full")} />
				</>
			}
			actionsLabel="Workspace loading actions"
			center={
				<div className="flex min-w-0 flex-1 items-center gap-1 px-1">
					<Skeleton className="h-8 w-32 rounded-md" />
					<Skeleton className="h-4 w-px shrink-0 rounded-none" />
					<Skeleton className="h-8 w-28 rounded-md" />
				</div>
			}
			contextBar={<WorkspaceContextBarSkeleton />}
		/>
	);
}

function WorkspaceMobileShellSkeleton({
	chatSurfaceMode,
}: {
	chatSurfaceMode: WorkspaceMobileChatSurfaceMode;
}) {
	return (
		<WorkspaceMobileFrame
			actions={
				<>
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
					<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-full")} />
					<div
						className={cn(
							"inline-flex items-center justify-center rounded-md border border-border bg-background shadow-xs",
							workspaceToolbarTextButtonClass,
						)}
					>
						<MessageSquare className="size-4" aria-hidden="true" />
						<Skeleton className="h-4 w-8 rounded-sm" />
					</div>
				</>
			}
			chatPanel={<WorkspaceSkeletonAiChatPanel />}
			chatSurfaceMode={chatSurfaceMode}
			contextBar={<WorkspaceMobileContextBarSkeleton />}
			content={<WorkspaceMobileSkeletonContent />}
		/>
	);
}

function WorkspaceContextBarSkeleton() {
	return (
		<div className="flex h-12 items-center justify-between gap-3 bg-background px-4 text-sm sm:h-11">
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
		<div className="flex h-12 items-center justify-between gap-3 bg-background px-4 text-sm sm:h-11">
			<div className="flex min-w-0 items-center gap-1.5">
				<Skeleton className="size-3.5 rounded-sm" />
				<Skeleton className="h-4 w-28 rounded-sm" />
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
				<Skeleton className={cn(workspaceToolbarButtonSizeClass, "rounded-md")} />
			</div>
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
