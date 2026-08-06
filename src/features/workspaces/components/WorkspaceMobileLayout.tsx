import { Ellipsis, MessageSquare } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import UserProfileDropdown from "#/components/UserProfileDropdown";
import WorkspaceMobileFrame from "#/features/workspaces/components/WorkspaceMobileFrame";
import WorkspaceRootActionsMenu from "#/features/workspaces/components/WorkspaceRootActionsMenu";
import {
	WorkspaceToolbarIconButton,
	WorkspaceToolbarTextButton,
} from "#/features/workspaces/components/WorkspaceToolbar";
import type { WorkspaceSummary } from "#/features/workspaces/contracts";
import type { WorkspaceMobileChatSurfaceMode } from "#/features/workspaces/model/workspace-ui";

interface WorkspaceMobileLayoutProps {
	workspace: WorkspaceSummary;
	contextBar: ReactNode;
	content: ReactNode;
	chatPanel?: ReactElement;
	chatSurfaceMode: WorkspaceMobileChatSurfaceMode;
	onOpenChat: () => void;
}

export default function WorkspaceMobileLayout({
	workspace,
	contextBar,
	content,
	chatPanel,
	chatSurfaceMode,
	onOpenChat,
}: WorkspaceMobileLayoutProps) {
	const isChatOpen = chatSurfaceMode !== "hidden";

	return (
		<WorkspaceMobileFrame
			actions={
				<>
					<div className="flex items-center gap-1">
						<WorkspaceRootActionsMenu
							workspace={workspace}
							align="end"
							trigger={
								<WorkspaceToolbarIconButton aria-label="Open workspace actions">
									<Ellipsis />
								</WorkspaceToolbarIconButton>
							}
						/>
						<UserProfileDropdown />
					</div>
					{!isChatOpen ? (
						<WorkspaceToolbarTextButton
							variant="outline"
							className="border-border bg-background shadow-xs hover:bg-muted"
							onClick={onOpenChat}
						>
							<MessageSquare />
							<span>Chat</span>
						</WorkspaceToolbarTextButton>
					) : null}
				</>
			}
			chatPanel={chatPanel}
			chatSurfaceMode={chatSurfaceMode}
			contextBar={contextBar}
			content={content}
		/>
	);
}
