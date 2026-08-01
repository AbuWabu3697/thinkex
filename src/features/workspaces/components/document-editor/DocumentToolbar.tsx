import type { Editor } from "@tiptap/react";
import { Check, Download, EllipsisVertical, FileText, Redo2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { DocumentEditUndoButton } from "#/features/workspaces/components/document-editor/DocumentEditUndoButton";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import {
	type DocumentEditorUiState,
	getActiveInlineFormat,
	useDocumentEditorUiState,
} from "#/features/workspaces/components/document-editor/document-editor-state";
import {
	type DocumentToolbarAction,
	documentBlockActions,
	documentFontSizeActions,
	documentInlineActions,
	documentTextAlignActions,
	getFontSizeIcon,
	getInlineMarkIcon,
	getStructureBlockIcon,
	getTextAlignIcon,
	isCodeBlock,
} from "#/features/workspaces/components/document-editor/document-editor-toolbar-actions";
import {
	WorkspaceResponsiveToolbar,
	WorkspaceToolbarIconButton,
} from "#/features/workspaces/components/WorkspaceToolbar";
import {
	workspaceToolbarGroupClassName,
	workspaceToolbarTextButtonSizeClass,
} from "#/features/workspaces/components/workspace-toolbar-styles";

export function DocumentToolbar({
	canEdit,
	editor,
	itemId,
	slotId,
}: {
	canEdit: boolean;
	editor: Editor | null;
	itemId: string;
	slotId: string;
}) {
	const editorState = useDocumentEditorUiState(editor);
	const { activeReview, hideReview } = useDocumentEditReview();

	// Reviewing borrows the toolbar rather than floating over the page: the
	// formatting controls are unusable mid-review anyway, so the space is free.
	if (activeReview?.itemId === itemId && activeReview.viewInstanceId === slotId) {
		return (
			<DocumentEditReviewControls
				canUndo={canEdit}
				itemId={itemId}
				receiptIds={activeReview.receiptIds}
				onDone={hideReview}
			/>
		);
	}

	// Read-only viewers get every formatting control disabled, which reads as a
	// broken toolbar. Show only what still works.
	if (!canEdit) {
		return (
			<WorkspaceResponsiveToolbar
				mobileLabel="Document actions"
				mobileContent={<DocumentExportMenuGroup />}
			>
				<DocumentMoreMenu />
			</WorkspaceResponsiveToolbar>
		);
	}

	return (
		<WorkspaceResponsiveToolbar
			mobileLabel="Document actions"
			mobileContent={<DocumentMobileMenuContent editor={editor} editorState={editorState} />}
			mobileContentClassName="max-h-[min(var(--available-height),28rem)] w-64 max-w-[calc(100dvw-2rem)] overscroll-contain"
			scrollable
		>
			<BlockTypeMenu editor={editor} editorState={editorState} />
			<InlineFormatMenu editor={editor} editorState={editorState} />
			<AlignMenu editor={editor} editorState={editorState} />
			<ToolbarButton
				label="Undo"
				disabled={!editorState.canUndo}
				onClick={() => editor?.chain().focus().undo().run()}
			>
				<Undo2 />
			</ToolbarButton>
			<ToolbarButton
				label="Redo"
				disabled={!editorState.canRedo}
				onClick={() => editor?.chain().focus().redo().run()}
			>
				<Redo2 />
			</ToolbarButton>
			<DocumentMoreMenu disabled={!editor} />
		</WorkspaceResponsiveToolbar>
	);
}

function DocumentEditReviewControls({
	canUndo,
	itemId,
	onDone,
	receiptIds,
}: {
	canUndo: boolean;
	itemId: string;
	onDone: () => void;
	receiptIds: string[];
}) {
	const { workspaceId } = useDocumentEditReview();

	return (
		<div className={workspaceToolbarGroupClassName}>
			<span className="min-w-0 truncate px-2 text-muted-foreground text-sm">
				Reviewing changes:
			</span>
			{canUndo ? (
				<DocumentEditUndoButton
					className={workspaceToolbarTextButtonSizeClass}
					itemId={itemId}
					receiptIds={receiptIds}
					workspaceId={workspaceId}
				/>
			) : null}
			<Button
				type="button"
				size="sm"
				className={workspaceToolbarTextButtonSizeClass}
				onClick={onDone}
			>
				Done
			</Button>
		</div>
	);
}

function DocumentMobileMenuContent({
	editor,
	editorState,
}: {
	editor: Editor | null;
	editorState: DocumentEditorUiState;
}) {
	return (
		<>
			<DocumentActionGroup
				actions={documentFontSizeActions}
				editor={editor}
				editorState={editorState}
				label="Text style"
			/>
			<DropdownMenuSeparator />
			<DocumentActionGroup
				actions={documentBlockActions}
				editor={editor}
				editorState={editorState}
			/>
			<DropdownMenuSeparator />
			<DocumentActionGroup
				actions={documentInlineActions}
				editor={editor}
				editorState={editorState}
				label="Formatting"
			/>
			<DropdownMenuSeparator />
			<DocumentActionGroup
				actions={documentTextAlignActions}
				editor={editor}
				editorState={editorState}
				label="Alignment"
			/>
			<DropdownMenuSeparator />
			<DropdownMenuGroup>
				<DocumentHistoryMenuItem
					disabled={!editorState.canUndo}
					icon={<Undo2 />}
					label="Undo"
					onClick={() => editor?.chain().focus().undo().run()}
				/>
				<DocumentHistoryMenuItem
					disabled={!editorState.canRedo}
					icon={<Redo2 />}
					label="Redo"
					onClick={() => editor?.chain().focus().redo().run()}
				/>
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DocumentExportMenuGroup />
		</>
	);
}

function DocumentActionGroup({
	actions,
	editor,
	editorState,
	label,
}: {
	actions: DocumentToolbarAction[];
	editor: Editor | null;
	editorState: DocumentEditorUiState;
	label?: string;
}) {
	return (
		<DropdownMenuGroup>
			{label ? <DropdownMenuLabel>{label}</DropdownMenuLabel> : null}
			{actions.map((action) => (
				<DocumentMenuAction
					key={action.id}
					action={action}
					editor={editor}
					editorState={editorState}
				/>
			))}
		</DropdownMenuGroup>
	);
}

function BlockTypeMenu({
	editor,
	editorState,
}: {
	editor: Editor | null;
	editorState: DocumentEditorUiState;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<WorkspaceToolbarIconButton disabled={!editor} aria-label="Text block" />}
			>
				{editorState.block.kind === "structure" ? (
					getStructureBlockIcon(editorState.block.type)
				) : (
					<span className="truncate">{getFontSizeIcon(editorState.block.size)}</span>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-44">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Text style</DropdownMenuLabel>
					{documentFontSizeActions.map((action) => (
						<DocumentMenuAction
							key={action.id}
							action={action}
							editor={editor}
							editorState={editorState}
						/>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				{documentBlockActions.map((action) => (
					<DocumentMenuAction
						key={action.id}
						action={action}
						editor={editor}
						editorState={editorState}
					/>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AlignMenu({
	editor,
	editorState,
}: {
	editor: Editor | null;
	editorState: DocumentEditorUiState;
}) {
	const disabled = !editor || isCodeBlock(editorState);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<WorkspaceToolbarIconButton disabled={disabled} aria-label="Text alignment" />}
			>
				{getTextAlignIcon(editorState.textAlign)}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-44">
				{documentTextAlignActions.map((action) => (
					<DocumentMenuAction
						key={action.id}
						action={action}
						editor={editor}
						editorState={editorState}
					/>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function InlineFormatMenu({
	editor,
	editorState,
}: {
	editor: Editor | null;
	editorState: DocumentEditorUiState;
}) {
	const activeFormat = getActiveInlineFormat(editorState.inlineMarks);
	const disabled = !editor || isCodeBlock(editorState);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<WorkspaceToolbarIconButton
						className={activeFormat ? "text-foreground" : undefined}
						disabled={disabled}
						aria-label="Text formatting"
					/>
				}
			>
				{activeFormat ? getInlineMarkIcon(activeFormat) : getInlineMarkIcon("bold")}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-44">
				{documentInlineActions.map((action) => (
					<DocumentMenuAction
						key={action.id}
						action={action}
						editor={editor}
						editorState={editorState}
					/>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function DocumentMenuAction({
	action,
	editor,
	editorState,
}: {
	action: DocumentToolbarAction;
	editor: Editor | null;
	editorState: DocumentEditorUiState;
}) {
	const active = action.active?.(editorState) ?? false;
	const disabled = !editor || (action.disabled?.(editorState) ?? false);

	return (
		<DropdownMenuItem
			className="[&_svg:not([class*='size-'])]:size-4"
			disabled={disabled}
			onClick={() => {
				if (editor && !disabled) {
					action.run(editor);
				}
			}}
		>
			<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
				{action.icon}
			</span>
			{action.label}
			{active ? <Check className="ml-auto size-3.5 text-muted-foreground" /> : null}
		</DropdownMenuItem>
	);
}

function DocumentMoreMenu({ disabled }: { disabled?: boolean }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<WorkspaceToolbarIconButton disabled={disabled} aria-label="More document actions" />
				}
			>
				<EllipsisVertical />
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-48" align="end">
				<DocumentExportMenuGroup />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function DocumentExportMenuGroup() {
	return (
		<DropdownMenuGroup>
			<DropdownMenuLabel>Export</DropdownMenuLabel>
			<DropdownMenuItem className="[&_svg:not([class*='size-'])]:size-4" disabled>
				<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
					<Download />
				</span>
				PDF
				<span className="ml-auto text-xs text-muted-foreground">Soon</span>
			</DropdownMenuItem>
			<DropdownMenuItem className="[&_svg:not([class*='size-'])]:size-4" disabled>
				<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
					<FileText />
				</span>
				Google Docs
				<span className="ml-auto text-xs text-muted-foreground">Soon</span>
			</DropdownMenuItem>
		</DropdownMenuGroup>
	);
}

function DocumentHistoryMenuItem({
	disabled,
	icon,
	label,
	onClick,
}: {
	disabled?: boolean;
	icon: ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<DropdownMenuItem
			className="[&_svg:not([class*='size-'])]:size-4"
			disabled={disabled}
			onClick={onClick}
		>
			<span className="inline-flex size-4 items-center justify-center text-muted-foreground">
				{icon}
			</span>
			{label}
		</DropdownMenuItem>
	);
}

function ToolbarButton({
	children,
	disabled,
	label,
	onClick,
}: {
	children: ReactNode;
	disabled?: boolean;
	label: string;
	onClick?: () => void;
}) {
	const button = (
		<WorkspaceToolbarIconButton disabled={disabled} aria-label={label} onClick={onClick}>
			{children}
		</WorkspaceToolbarIconButton>
	);

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
