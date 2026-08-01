import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { FilePen, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import type { AiChatDocumentEditGroup } from "#/features/workspaces/components/ai-chat/ai-chat-document-edit-actions";
import { useWorkspaceMutationAccess } from "#/features/workspaces/components/workspace-mutation-access";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type {
	DocumentEditLineChanges,
	DocumentEditReceiptUnavailableStatus,
} from "#/features/workspaces/documents/document-edit-receipt";
import { undoDocumentEditReceiptFn } from "#/features/workspaces/documents/document-edit-review-functions";
import {
	documentEditReceiptQueryKey,
	documentEditReceiptStatusQueryOptions,
} from "#/features/workspaces/documents/document-edit-review-queries";
import { getWorkspacePathName } from "#/features/workspaces/kernel/workspace-kernel-paths";

interface SettledDocumentEditGroup {
	changes?: DocumentEditLineChanges;
	group: AiChatDocumentEditGroup;
	reverted: boolean;
}

/**
 * Receipt for the documents the assistant changed in one turn: a header saying
 * how much happened, then one row per document with its line tally and actions.
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
	const settledGroups = groups.flatMap<SettledDocumentEditGroup>((group, index) => {
		const result = statusQueries[index]?.data;

		if (result?.status !== "ready" && result?.status !== "reverted") {
			return [];
		}

		return [
			{
				...(result.changes ? { changes: result.changes } : {}),
				group,
				reverted: result.status === "reverted",
			},
		];
	});

	if (settledGroups.length === 0) {
		return null;
	}

	return (
		<div
			aria-label="Document changes from this response"
			className="mt-2 overflow-hidden rounded-lg bg-muted/40"
		>
			<div className="flex items-center gap-2 px-2.5 py-2">
				<FilePen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span className="font-medium text-sm">
					Edited {settledGroups.length} {settledGroups.length === 1 ? "document" : "documents"}
				</span>
			</div>
			<div className="divide-y divide-foreground/5 border-foreground/5 border-t">
				{settledGroups.map((settled) => (
					<DocumentEditRow key={settled.group.itemId} settled={settled} />
				))}
			</div>
		</div>
	);
}

function DocumentEditRow({ settled }: { settled: SettledDocumentEditGroup }) {
	const queryClient = useQueryClient();
	const { capabilities } = useWorkspaceMutationAccess();
	const { activeReview, hideReview, showReview, workspaceId } = useDocumentEditReview();
	const { group, reverted } = settled;
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
		<div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
			<div className={`min-w-0 flex-1 ${reverted ? "opacity-60" : ""}`}>
				<div className="truncate text-sm" title={group.path}>
					<DocumentPathLabel path={group.path} />
				</div>
				<ChangeSummary changes={settled.changes} reverted={reverted} />
			</div>
			{reverted ? null : (
				<div className="flex shrink-0 items-center gap-1">
					{capabilities.canMutateContent ? (
						<Button
							type="button"
							variant="ghost"
							size="xs"
							disabled={undoMutation.isPending}
							onClick={() => undoMutation.mutate()}
						>
							{undoMutation.isPending ? (
								<LoaderCircle className="animate-spin" aria-hidden="true" />
							) : null}
							Undo
						</Button>
					) : null}
					<Button
						type="button"
						variant="outline"
						size="xs"
						onClick={() => {
							if (isReviewActive) {
								hideReview();
							} else if (!showReview({ itemId, receiptIds: group.receiptIds })) {
								toast.error("This document is no longer open.");
							}
						}}
					>
						{isReviewActive ? "Hide" : "Review"}
					</Button>
				</div>
			)}
		</div>
	);
}

function DocumentPathLabel({ path }: { path: string }) {
	const separatorIndex = path.lastIndexOf("/");
	const folder = separatorIndex > 0 ? path.slice(0, separatorIndex + 1) : "";

	return (
		<>
			{folder ? <span className="text-muted-foreground">{folder}</span> : null}
			<span className="font-medium">{getWorkspacePathName(path)}</span>
		</>
	);
}

function ChangeSummary({
	changes,
	reverted,
}: {
	changes?: DocumentEditLineChanges;
	reverted: boolean;
}) {
	if (reverted) {
		return <div className="mt-0.5 text-muted-foreground text-xs">Undone</div>;
	}

	if (!changes?.added && !changes?.removed) {
		return null;
	}

	// Colour carries the meaning at a glance, muted so a removal reads as a fact
	// rather than an alarm.
	return (
		<div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
			<span>Lines</span>
			{changes.added > 0 ? <span className="text-success/90">+{changes.added}</span> : null}
			{changes.added > 0 && changes.removed > 0 ? (
				<span className="text-muted-foreground/50">·</span>
			) : null}
			{changes.removed > 0 ? <span className="text-destructive/80">−{changes.removed}</span> : null}
		</div>
	);
}

const undoUnavailableMessages: Record<DocumentEditReceiptUnavailableStatus, string> = {
	content_changed: "This document changed after these edits, so they were not undone.",
	not_found: "These changes are no longer available.",
	not_latest: "Undo the newer changes first.",
	reverted: "These changes were already undone.",
	review_unavailable: "Undo is unavailable for this large document.",
};
