import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, LoaderCircle, PencilLine, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import type { AiChatDocumentEditGroup } from "#/features/workspaces/components/ai-chat/ai-chat-document-edit-actions";
import { useWorkspaceMutationAccess } from "#/features/workspaces/components/workspace-mutation-access";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type { DocumentEditReceiptUnavailableStatus } from "#/features/workspaces/documents/document-edit-receipt";
import { undoDocumentEditReceiptFn } from "#/features/workspaces/documents/document-edit-review-functions";
import {
	documentEditReceiptQueryKey,
	documentEditReceiptStatusQueryOptions,
} from "#/features/workspaces/documents/document-edit-review-queries";
import { getWorkspacePathName } from "#/features/workspaces/kernel/workspace-kernel-paths";

/**
 * Card summarising the documents the assistant changed in one turn. Everything
 * here is read by people who did not ask for a diff, so it names documents and
 * offers two plain actions rather than reporting counts of applied operations.
 */
export function AiChatDocumentEditActions({
	groups,
}: {
	groups: readonly AiChatDocumentEditGroup[];
}) {
	const { workspaceId } = useDocumentEditReview();
	const statusQueries = useQueries({
		queries: groups.map((group) =>
			documentEditReceiptStatusQueryOptions({
				itemId: group.itemId,
				receiptIds: group.receiptIds,
				workspaceId,
			}),
		),
	});
	const settledGroups = groups.flatMap((group, index) => {
		const status = statusQueries[index]?.data?.status;
		return status === "ready" || status === "reverted"
			? [{ group, reverted: status === "reverted" }]
			: [];
	});

	if (settledGroups.length === 0) {
		return null;
	}

	const firstGroup = settledGroups[0];

	return (
		<div
			aria-label="Document changes from this response"
			className="mt-2.5 overflow-hidden rounded-xl bg-card/60 ring-1 ring-foreground/10"
		>
			{settledGroups.length === 1 && firstGroup ? (
				<DocumentEditCardRow
					group={firstGroup.group}
					icon={<CardIcon />}
					reverted={firstGroup.reverted}
				/>
			) : (
				<>
					<div className="flex items-center gap-2.5 px-3 py-2.5">
						<CardIcon />
						<span className="font-medium text-sm">Updated {settledGroups.length} documents</span>
					</div>
					<div className="divide-y divide-foreground/5 border-foreground/10 border-t">
						{settledGroups.map(({ group, reverted }) => (
							<DocumentEditCardRow key={group.itemId} group={group} reverted={reverted} />
						))}
					</div>
				</>
			)}
		</div>
	);
}

function CardIcon() {
	return (
		<span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
			<PencilLine className="size-3.5" aria-hidden="true" />
		</span>
	);
}

function DocumentEditCardRow({
	group,
	icon,
	reverted,
}: {
	group: AiChatDocumentEditGroup;
	icon?: ReactNode;
	reverted: boolean;
}) {
	const queryClient = useQueryClient();
	const { capabilities } = useWorkspaceMutationAccess();
	const { activeReview, hideReview, showReview, workspaceId } = useDocumentEditReview();
	const { itemId } = group;
	const receiptKey = group.receiptIds.join(":");
	const target = { itemId, receiptIds: group.receiptIds, workspaceId };
	const undoMutation = useMutation({
		mutationFn: () => undoDocumentEditReceiptFn({ data: target }),
		onSuccess: async (result) => {
			if (result.status === "reverted") {
				hideReview();
				toast.success("Changes undone.");
			} else {
				toast.error(undoUnavailableMessages[result.status]);
			}

			queryClient.setQueryData(documentEditReceiptQueryKey(target, "status"), result);
			await queryClient.invalidateQueries({
				queryKey: ["workspace-document-edit-receipt", workspaceId, itemId],
			});
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Could not undo these changes.");
		},
	});
	const isReviewActive = Boolean(
		activeReview &&
		activeReview.itemId === itemId &&
		activeReview.receiptIds.join(":") === receiptKey,
	);

	return (
		<div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
			{icon ?? <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
			<DocumentName path={group.path} muted={reverted} />
			{reverted ? (
				<span className="shrink-0 text-muted-foreground text-xs">Undone</span>
			) : (
				<div className="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="xs"
						onClick={() => {
							if (isReviewActive) {
								hideReview();
							} else if (!showReview({ itemId, receiptIds: group.receiptIds })) {
								toast.error("This document is no longer open.");
							}
						}}
					>
						{isReviewActive ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
						{isReviewActive ? "Hide" : "Review"}
					</Button>
					{capabilities.canMutateContent ? (
						<Button
							type="button"
							variant="outline"
							size="xs"
							disabled={undoMutation.isPending}
							onClick={() => undoMutation.mutate()}
						>
							{undoMutation.isPending ? (
								<LoaderCircle className="animate-spin" aria-hidden="true" />
							) : (
								<Undo2 aria-hidden="true" />
							)}
							Undo
						</Button>
					) : null}
				</div>
			)}
		</div>
	);
}

function DocumentName({ muted, path }: { muted: boolean; path: string }) {
	const name = getWorkspacePathName(path);
	const separatorIndex = path.lastIndexOf("/");
	const folder = separatorIndex > 0 ? path.slice(0, separatorIndex + 1) : "";

	return (
		<span className={`mr-auto min-w-0 truncate text-sm ${muted ? "opacity-60" : ""}`} title={path}>
			{folder ? <span className="text-muted-foreground">{folder}</span> : null}
			<span className="font-medium">{name}</span>
		</span>
	);
}

const undoUnavailableMessages: Record<DocumentEditReceiptUnavailableStatus, string> = {
	content_changed: "This document changed after these edits, so they were not undone.",
	not_found: "These changes are no longer available.",
	not_latest: "Undo the newer changes first.",
	reverted: "These changes were already undone.",
	review_unavailable: "Undo is unavailable for this large document.",
};
