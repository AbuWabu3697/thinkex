import { useQueries } from "@tanstack/react-query";
import { FilePen } from "lucide-react";
import { toast } from "sonner";

import type { AiChatDocumentEditGroup } from "#/features/workspaces/components/ai-chat/ai-chat-document-edit-actions";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";
import { useWorkspaceLocationActions } from "#/features/workspaces/locations/workspace-location-context";
import type {
	DocumentEditLineChanges,
	DocumentEditReceiptStatus,
	DocumentEditReceiptUnavailableStatus,
} from "#/features/workspaces/documents/document-edit-receipt";
import { documentEditReceiptStatusQueryOptions } from "#/features/workspaces/documents/document-edit-review-queries";
import { getWorkspacePathName } from "#/features/workspaces/kernel/workspace-kernel-paths";

interface SettledDocumentEditGroup {
	changes?: DocumentEditLineChanges;
	group: AiChatDocumentEditGroup;
	status: DocumentEditReceiptStatus;
}

/**
 * Receipt for the documents the assistant changed in one turn: a header saying
 * how much happened, then one row per document with its line tally.
 *
 * Every document the assistant touched keeps its row for good. Whether the
 * changes can still be reviewed or undone comes and goes — editing the document
 * yourself closes that window — but the record of what happened should not
 * disappear from the transcript when it does.
 */
export function AiChatDocumentEditActions({
	groups,
}: {
	groups: readonly AiChatDocumentEditGroup[];
}) {
	const { workspaceId } = useDocumentEditReview();
	// A deleted document has no receipts left to ask about, and asking anyway
	// makes the server load a document that is gone.
	const { hasItem } = useWorkspaceLocationActions();
	const knownGroups = groups.filter((group) => hasItem(group.itemId));
	const statusQueries = useQueries({
		queries: knownGroups.map((group) =>
			documentEditReceiptStatusQueryOptions({
				itemId: group.itemId,
				receiptIds: group.receiptIds,
				workspaceId,
			}),
		),
	});
	const settledGroups = knownGroups.flatMap<SettledDocumentEditGroup>((group, index) => {
		const result = statusQueries[index]?.data;

		return result
			? [{ ...(result.changes ? { changes: result.changes } : {}), group, status: result.status }]
			: [];
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
	const { showReview } = useDocumentEditReview();
	const { group, status } = settled;
	const summary = (
		<>
			<div className="truncate text-sm" title={group.path}>
				<DocumentPathLabel path={group.path} />
			</div>
			<ChangeSummary changes={settled.changes} status={status} />
		</>
	);

	// Once the changes cannot be reviewed the row stays, but as a record rather
	// than a destination.
	if (status !== "ready") {
		return <div className="min-w-0 px-2.5 py-2 opacity-60">{summary}</div>;
	}

	// The row is a destination, not a toggle: clicking it always takes you to the
	// changes, opening the document or switching tabs as needed. Review ends from
	// the toolbar, where Done sits next to Undo.
	return (
		<button
			type="button"
			className="flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-foreground/5"
			onClick={() => {
				if (!showReview({ itemId: group.itemId, receiptIds: group.receiptIds })) {
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
	status,
}: {
	changes?: DocumentEditLineChanges;
	status: DocumentEditReceiptStatus;
}) {
	if (status !== "ready") {
		return <div className="mt-0.5 text-muted-foreground text-xs">{unreviewableNotes[status]}</div>;
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

const unreviewableNotes: Record<DocumentEditReceiptUnavailableStatus, string> = {
	content_changed: "Edited since",
	not_found: "No longer available",
	not_latest: "Newer changes since",
	reverted: "Undone",
	review_unavailable: "Too large to review",
};
