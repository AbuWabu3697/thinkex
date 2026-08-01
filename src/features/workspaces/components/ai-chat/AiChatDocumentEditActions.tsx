import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, LoaderCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import type { AiChatDocumentEditGroup } from "#/features/workspaces/components/ai-chat/ai-chat-document-edit-actions";
import { useWorkspaceMutationAccess } from "#/features/workspaces/components/workspace-mutation-access";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type {
	DocumentEditBlockChanges,
	DocumentEditReceiptUnavailableStatus,
} from "#/features/workspaces/documents/document-edit-receipt";
import { undoDocumentEditReceiptFn } from "#/features/workspaces/documents/document-edit-review-functions";
import {
	documentEditReceiptQueryKey,
	documentEditReceiptStatusQueryOptions,
} from "#/features/workspaces/documents/document-edit-review-queries";
import { getWorkspacePathName } from "#/features/workspaces/kernel/workspace-kernel-paths";

interface SettledDocumentEditGroup {
	changes?: DocumentEditBlockChanges;
	group: AiChatDocumentEditGroup;
	reverted: boolean;
}

/**
 * Everything the assistant changed in one turn, in one card. Counts are stated
 * in words rather than +/- diff stats: this is read by people who did not ask
 * for a diff, and "21 deletions" reads as damage when it was a rewritten line.
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
			className="mt-2 overflow-hidden rounded-lg bg-card/40 ring-1 ring-foreground/10"
		>
			{settledGroups.length > 1 ? (
				<div className="flex items-center gap-2 border-foreground/10 border-b px-2.5 py-1.5 text-muted-foreground text-xs">
					<FileText className="size-3.5 shrink-0" aria-hidden="true" />
					<span className="font-medium text-foreground">
						Edited {settledGroups.length} documents
					</span>
					<span>{summarizeSettledGroups(settledGroups)}</span>
				</div>
			) : null}
			<div className="divide-y divide-foreground/5">
				{settledGroups.map((settled) => (
					<DocumentEditRow
						key={settled.group.itemId}
						settled={settled}
						showIcon={settledGroups.length === 1}
					/>
				))}
			</div>
		</div>
	);
}

function DocumentEditRow({
	settled,
	showIcon,
}: {
	settled: SettledDocumentEditGroup;
	showIcon: boolean;
}) {
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
	const summary = settled.changes ? formatBlockChanges(settled.changes) : "";

	return (
		<div className="flex min-w-0 items-center gap-2 px-2.5 py-1.5">
			{showIcon ? (
				<FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
			) : null}
			<span
				className={`min-w-0 truncate text-sm ${reverted ? "opacity-60" : ""}`}
				title={group.path}
			>
				<DocumentPathLabel path={group.path} />
			</span>
			{summary && !reverted ? (
				<span className="shrink-0 text-muted-foreground text-xs">{summary}</span>
			) : null}
			<div className="ml-auto flex shrink-0 items-center gap-1">
				{reverted ? (
					<span className="text-muted-foreground text-xs">Undone</span>
				) : (
					<>
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
								) : (
									<Undo2 aria-hidden="true" />
								)}
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
							{isReviewActive ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
							{isReviewActive ? "Hide" : "Review"}
						</Button>
					</>
				)}
			</div>
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

function summarizeSettledGroups(settledGroups: SettledDocumentEditGroup[]) {
	return formatBlockChanges(
		settledGroups.reduce<DocumentEditBlockChanges>(
			(total, settled) => ({
				added: total.added + (settled.changes?.added ?? 0),
				edited: total.edited + (settled.changes?.edited ?? 0),
				removed: total.removed + (settled.changes?.removed ?? 0),
			}),
			{ added: 0, edited: 0, removed: 0 },
		),
	);
}

function formatBlockChanges(changes: DocumentEditBlockChanges) {
	return [
		changes.added > 0 ? `${changes.added} added` : "",
		changes.edited > 0 ? `${changes.edited} rewritten` : "",
		changes.removed > 0 ? `${changes.removed} removed` : "",
	]
		.filter(Boolean)
		.join(" · ");
}

const undoUnavailableMessages: Record<DocumentEditReceiptUnavailableStatus, string> = {
	content_changed: "This document changed after these edits, so they were not undone.",
	not_found: "These changes are no longer available.",
	not_latest: "Undo the newer changes first.",
	reverted: "These changes were already undone.",
	review_unavailable: "Undo is unavailable for this large document.",
};
