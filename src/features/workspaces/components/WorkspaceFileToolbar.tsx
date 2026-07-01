import { Camera, Download } from "lucide-react";

import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "#/components/ui/dropdown-menu";
import {
	WorkspaceResponsiveToolbar,
	WorkspaceToolbarMenuButton,
	WorkspaceToolbarTextButton,
} from "#/features/workspaces/components/WorkspaceToolbar";
import { cn } from "#/lib/utils";

export function WorkspaceFileToolbar({
	capture,
	fileName,
	fileUrl,
}: {
	capture?: {
		isActive: boolean;
		onToggle: () => void;
	};
	fileName: string;
	fileUrl: string;
}) {
	const handleDownload = () => {
		const link = document.createElement("a");
		link.href = fileUrl;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		link.remove();
	};

	return (
		<WorkspaceResponsiveToolbar
			mobileLabel="File actions"
			mobileContent={
				<WorkspaceFileActionsMenuContent capture={capture} onDownload={handleDownload} />
			}
			scrollable
		>
			{capture ? (
				<WorkspaceToolbarTextButton
					className={cn(
						capture.isActive
							? "bg-blue-500/10 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
							: undefined,
					)}
					aria-pressed={capture.isActive}
					onClick={capture.onToggle}
				>
					<Camera />
					Capture
				</WorkspaceToolbarTextButton>
			) : null}
			<WorkspaceFileMoreMenu onDownload={handleDownload} />
		</WorkspaceResponsiveToolbar>
	);
}

function WorkspaceFileMoreMenu({ onDownload }: { onDownload: () => void }) {
	return (
		<WorkspaceToolbarMenuButton
			aria-label="More file actions"
			contentClassName="w-48"
			content={<WorkspaceFileActionsMenuContent onDownload={onDownload} />}
		/>
	);
}

function WorkspaceFileActionsMenuContent({
	capture,
	onDownload,
}: {
	capture?: {
		isActive: boolean;
		onToggle: () => void;
	};
	onDownload: () => void;
}) {
	return (
		<>
			{capture ? (
				<>
					<DropdownMenuGroup>
						<DropdownMenuItem onClick={capture.onToggle}>
							<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
								<Camera />
							</span>
							Capture
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
				</>
			) : null}
			<DropdownMenuGroup>
				<DropdownMenuItem className="[&_svg:not([class*='size-'])]:size-4" onClick={onDownload}>
					<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
						<Download />
					</span>
					Download file
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</>
	);
}
