import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, LoaderCircle, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import type { AiChatDocumentEditGroup } from "#/features/workspaces/components/ai-chat/ai-chat-document-edit-actions";
import { useWorkspaceMutationAccess } from "#/features/workspaces/components/workspace-mutation-access";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type { DocumentEditReceiptUndoResult } from "#/features/workspaces/documents/document-edit-receipt";
import { undoDocumentEditReceiptFn } from "#/features/workspaces/documents/document-edit-review-functions";
import {
	documentEditReceiptQueryKey,
	documentEditReceiptStatusQueryOptions,
} from "#/features/workspaces/documents/document-edit-review-queries";
import { getWorkspacePathName } from "#/features/workspaces/kernel/workspace-kernel-paths";

export function AiChatDocumentEditActions({
	groups,
}: {
	groups: readonly AiChatDocumentEditGroup[];
}) {
	return (
		<div className="mt-2 space-y-1" aria-label="AI document changes">
			{groups.map((group) => (
				<DocumentEditActionRow key={group.path} group={group} />
			))}
		</div>
	);
}

function DocumentEditActionRow({ group }: { group: AiChatDocumentEditGroup }) {
	const queryClient = useQueryClient();
	const { capabilities } = useWorkspaceMutationAccess();
	const { activeReview, hideReview, showReview, workspaceId } = useDocumentEditReview();
	const { itemId } = group;
	const receiptKey = group.receiptIds.join(":");
	const target = itemId ? { itemId, receiptIds: group.receiptIds, workspaceId } : null;
	const statusQuery = useQuery({
		...documentEditReceiptStatusQueryOptions(
			target ?? { itemId: "unavailable", receiptIds: group.receiptIds, workspaceId },
		),
		enabled: Boolean(target),
	});
	const undoMutation = useMutation({
		mutationFn: async () => {
			if (!target) {
				throw new Error("Document is no longer available.");
			}
			return await undoDocumentEditReceiptFn({ data: target });
		},
		onSuccess: async (result) => {
			if (!target) {
				return;
			}
			if (result.status === "reverted") {
				hideReview();
				toast.success("AI changes undone.");
			} else {
				toast.error(getUndoUnavailableMessage(result.status));
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
	useEffect(() => {
		if (!itemId || statusQuery.data?.status !== "ready") {
			return;
		}

		for (const query of queryClient
			.getQueryCache()
			.findAll({ queryKey: ["workspace-document-edit-receipt", workspaceId, itemId] })) {
			if (query.queryKey[3] !== receiptKey && query.queryKey[4] === "status") {
				queryClient.setQueryData(query.queryKey, { status: "not_latest" });
			}
		}
	}, [itemId, queryClient, receiptKey, statusQuery.data?.status, workspaceId]);

	if (!target || !statusQuery.data) {
		return null;
	}

	const isReviewActive = Boolean(
		activeReview &&
		activeReview.itemId === itemId &&
		activeReview.receiptIds.join(":") === receiptKey,
	);
	const name = getWorkspacePathName(group.path);

	if (statusQuery.data.status === "reverted") {
		return (
			<div className="flex min-w-0 items-center gap-1.5 px-1 text-muted-foreground/70 text-[11px]">
				<FileText className="size-3.5 shrink-0" aria-hidden="true" />
				<span className="min-w-0 truncate" title={group.path}>
					{name}
				</span>
				<span className="shrink-0">· Undone</span>
			</div>
		);
	}
	if (statusQuery.data.status !== "ready") {
		return null;
	}

	return (
		<div className="flex min-w-0 items-center gap-1">
			<div className="mr-auto flex min-w-0 items-center gap-1.5 px-1 text-muted-foreground text-xs">
				<FileText className="size-3.5 shrink-0" aria-hidden="true" />
				<span className="min-w-0 truncate" title={group.path}>
					{name}
				</span>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="xs"
				className="shrink-0"
				onClick={() => {
					if (isReviewActive) {
						hideReview();
					} else if (!showReview({ itemId: group.itemId, receiptIds: group.receiptIds })) {
						toast.error("This document is no longer available.");
					}
				}}
			>
				{isReviewActive ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
				{isReviewActive ? "Hide changes" : "Show changes"}
			</Button>
			{capabilities.canMutateContent ? (
				<Button
					type="button"
					variant="ghost"
					size="xs"
					className="shrink-0"
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
	);
}

function getUndoUnavailableMessage(status: DocumentEditReceiptUndoResult["status"]) {
	switch (status) {
		case "content_changed":
			return "The document changed after these AI changes, so they were not undone.";
		case "not_latest":
			return "Undo newer AI changes first.";
		case "review_unavailable":
			return "Undo is unavailable for this large document.";
		case "not_found":
			return "These AI changes are no longer available.";
		case "reverted":
			return "These AI changes were already undone.";
	}
}
