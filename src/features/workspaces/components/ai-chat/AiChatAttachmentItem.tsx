import {
	FileTextIcon,
	GlobeIcon,
	ImageIcon,
	Music2Icon,
	PaperclipIcon,
	VideoIcon,
	XIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
	AttachmentTrigger,
} from "#/components/ui/attachment";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Skeleton } from "#/components/ui/skeleton";
import { Spinner } from "#/components/ui/spinner";
import type {
	AttachmentData,
	FileAttachmentData,
} from "#/features/workspaces/components/ai-chat/ai-chat-attachments";
import {
	getAttachmentLabel,
	getMediaCategory,
} from "#/features/workspaces/components/ai-chat/ai-chat-attachments";

const mediaCategoryIcons = {
	audio: Music2Icon,
	document: FileTextIcon,
	image: ImageIcon,
	source: GlobeIcon,
	unknown: PaperclipIcon,
	video: VideoIcon,
};

export function AiChatAttachmentGroup({ children }: { children: ReactNode }) {
	return <AttachmentGroup>{children}</AttachmentGroup>;
}

export function AiChatAttachmentItem({
	data,
	onRemove,
}: {
	data: AttachmentData;
	onRemove?: () => void;
}) {
	if (isImageAttachment(data)) {
		return <AiChatImageAttachment data={data} onRemove={onRemove} />;
	}

	return (
		<Attachment state={getAttachmentState(data)} size="sm">
			<AiChatAttachmentMedia data={data} />
			<AiChatAttachmentContent data={data} />
			<AiChatAttachmentRemoveAction data={data} onRemove={onRemove} />
		</Attachment>
	);
}

function isImageAttachment(data: AttachmentData): data is FileAttachmentData {
	return data.type === "file" && getMediaCategory(data) === "image";
}

function AiChatImageAttachment({
	data,
	onRemove,
}: {
	data: FileAttachmentData;
	onRemove?: () => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const label = getAttachmentLabel(data);
	const imageUrl = data.status === "ready" ? data.url : undefined;

	return (
		<>
			<Attachment
				className={imageUrl ? "cursor-zoom-in focus-within:ring-2" : undefined}
				orientation="vertical"
				size="default"
				state={getAttachmentState(data)}
			>
				<AttachmentMedia variant="image">
					{imageUrl ? (
						<img
							alt={label}
							className="size-full object-cover"
							height={96}
							src={imageUrl}
							width={96}
						/>
					) : (
						<>
							<Skeleton aria-hidden="true" className="size-full rounded-none bg-foreground/10" />
							<span className="sr-only">Preparing {label}</span>
						</>
					)}
				</AttachmentMedia>
				{imageUrl ? (
					<AttachmentTrigger aria-label={`Preview ${label}`} onClick={() => setIsOpen(true)} />
				) : null}
				<AiChatAttachmentRemoveAction data={data} onRemove={onRemove} />
			</Attachment>

			{imageUrl ? (
				<Dialog open={isOpen} onOpenChange={setIsOpen}>
					<DialogContent className="max-w-[min(96vw,900px)] gap-4 p-4 sm:max-w-4xl">
						<DialogHeader className="pr-8">
							<DialogTitle className="truncate text-base">{label}</DialogTitle>
						</DialogHeader>
						<div className="flex max-h-[78vh] min-h-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
							<img alt={label} className="max-h-[78vh] max-w-full object-contain" src={imageUrl} />
						</div>
					</DialogContent>
				</Dialog>
			) : null}
		</>
	);
}

function AiChatAttachmentMedia({ data }: { data: AttachmentData }) {
	if (data.type === "file" && data.status === "loading") {
		return (
			<AttachmentMedia>
				<Spinner className="size-3.5" />
			</AttachmentMedia>
		);
	}

	if (data.type === "file" && data.url && getMediaCategory(data) === "image") {
		return (
			<AttachmentMedia variant="image">
				<img
					alt={getAttachmentLabel(data)}
					className="size-full object-cover"
					height={40}
					src={data.url}
					width={40}
				/>
			</AttachmentMedia>
		);
	}

	if (data.type === "file" && data.url && getMediaCategory(data) === "video") {
		return (
			<AttachmentMedia>
				{/* Thumbnail-only tile — controls omitted intentionally (40 px square). */}
				<video
					aria-label={`Video preview: ${getAttachmentLabel(data)}`}
					className="size-full object-cover"
					muted
					src={data.url}
				/>
			</AttachmentMedia>
		);
	}

	const Icon = mediaCategoryIcons[getMediaCategory(data)];

	return (
		<AttachmentMedia>
			<Icon />
		</AttachmentMedia>
	);
}

function AiChatAttachmentContent({ data }: { data: AttachmentData }) {
	return (
		<AttachmentContent>
			<AttachmentTitle>{getAttachmentLabel(data)}</AttachmentTitle>
			<AttachmentDescription>{getAttachmentDescription(data)}</AttachmentDescription>
		</AttachmentContent>
	);
}

function AiChatAttachmentRemoveAction({
	data,
	onRemove,
}: {
	data: AttachmentData;
	onRemove?: () => void;
}) {
	if (!onRemove) {
		return null;
	}

	return (
		<AttachmentActions>
			<AttachmentAction
				aria-label={`Remove ${getAttachmentLabel(data)}`}
				onClick={(event) => {
					event.stopPropagation();
					onRemove();
				}}
			>
				<XIcon />
			</AttachmentAction>
		</AttachmentActions>
	);
}

function getAttachmentState(data: AttachmentData) {
	if (data.type === "file" && data.status === "loading") {
		return "uploading";
	}

	return "done";
}

function getAttachmentDescription(data: AttachmentData) {
	if (data.type === "source-document") {
		return "Source";
	}

	if (data.status === "loading") {
		return "Preparing";
	}

	return getMediaCategory(data);
}
