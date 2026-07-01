import type { ReactElement, ReactNode } from "react";

import WorkspaceFrame from "#/features/workspaces/components/WorkspaceFrame";
import WorkspaceHeaderChrome from "#/features/workspaces/components/WorkspaceHeaderChrome";
import type { WorkspaceMobileChatSurfaceMode } from "#/features/workspaces/model/workspace-ui";

interface WorkspaceMobileFrameProps {
	actions: ReactNode;
	contextBar: ReactNode;
	content: ReactNode;
	chatPanel?: ReactElement;
	chatSurfaceMode: WorkspaceMobileChatSurfaceMode;
}

export default function WorkspaceMobileFrame({
	actions,
	contextBar,
	content,
	chatPanel,
	chatSurfaceMode,
}: WorkspaceMobileFrameProps) {
	const isChatOpen = chatSurfaceMode === "fullscreen";

	return (
		<div data-app-shell className="h-dvh overflow-hidden bg-background text-foreground">
			<WorkspaceFrame
				chrome={
					<WorkspaceHeaderChrome
						actions={actions}
						actionsLabel="Workspace mobile actions"
						contextBar={contextBar}
						showWordmark={false}
					/>
				}
				content={content}
			/>

			{chatPanel && isChatOpen ? (
				<div className="fixed inset-0 z-50 h-dvh w-dvw bg-background">{chatPanel}</div>
			) : null}
		</div>
	);
}
