import { MessageSquare, Share2 } from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";

import UserProfileDropdown from "#/components/UserProfileDropdown";
import WorkspaceMobileFrame from "#/features/workspaces/components/WorkspaceMobileFrame";
import { WorkspaceShareDialog } from "#/features/workspaces/components/WorkspaceShareDialog";
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
	const [shareOpen, setShareOpen] = useState(false);
	const isChatOpen = chatSurfaceMode !== "hidden";

	return (
		<>
			<WorkspaceMobileFrame
				actions={
					<>
						<WorkspaceToolbarIconButton
							aria-label="Share workspace"
							onClick={() => setShareOpen(true)}
						>
							<Share2 />
						</WorkspaceToolbarIconButton>
						<UserProfileDropdown />
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
			<WorkspaceShareDialog
				membershipRole={workspace.membershipRole}
				onOpenChange={setShareOpen}
				open={shareOpen}
				workspaceId={workspace.id}
				workspaceName={workspace.name}
			/>
		</>
	);
}
