import { useQueries } from "@tanstack/react-query";
import { FilePen } from "lucide-react";
import { toast } from "sonner";

import type { AiChatDocumentEditGroup } from "#/features/workspaces/components/ai-chat/ai-chat-document-edit-actions";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import type { DocumentEditLineChanges } from "#/features/workspaces/documents/document-edit-receipt";
import { documentEditReceiptStatusQueryOptions } from "#/features/workspaces/documents/document-edit-review-queries";
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
			className="overflow-hidden rounded-lg bg-muted/40"
		>
			<div className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground text-xs">
				<FilePen className="size-3 shrink-0" aria-hidden="true" />
				<span className="font-medium">
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
	const { activeReview, hideReview, showReview } = useDocumentEditReview();
	const { group, reverted } = settled;
	const { itemId } = group;
	const receiptKey = group.receiptIds.join(":");
	const isReviewActive = Boolean(
		activeReview &&
		activeReview.itemId === itemId &&
		activeReview.receiptIds.join(":") === receiptKey,
	);
	const summary = (
		<>
			<div className="truncate text-sm" title={group.path}>
				<DocumentPathLabel path={group.path} />
			</div>
			<ChangeSummary changes={settled.changes} reverted={reverted} />
		</>
	);

	// An undone edit has nothing left to look at, so the row stops being a place
	// you can go.
	if (reverted) {
		return <div className="min-w-0 px-2.5 py-2 opacity-60">{summary}</div>;
	}

	// The row is the control. Opening the changes is the only thing to do from
	// here; undo lives in the toolbar, next to Done, once you can see what you
	// would be undoing.
	return (
		<button
			type="button"
			aria-pressed={isReviewActive}
			className="flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-foreground/5 aria-pressed:bg-foreground/5"
			onClick={() => {
				if (isReviewActive) {
					hideReview();
				} else if (!showReview({ itemId, receiptIds: group.receiptIds })) {
					// showReview opens the document, switching tabs if needed, so the
					// only way it fails is the document no longer existing.
					toast.error("This document no longer exists.");
				}
			}}
		>
			<div className="min-w-0 flex-1">{summary}</div>
		</button>
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
			<span>Lines:</span>
			{changes.added > 0 ? <span className="text-success/90">+{changes.added}</span> : null}
			{changes.added > 0 && changes.removed > 0 ? (
				<span className="text-muted-foreground/50">·</span>
			) : null}
			{changes.removed > 0 ? <span className="text-destructive/80">−{changes.removed}</span> : null}
		</div>
	);
}
