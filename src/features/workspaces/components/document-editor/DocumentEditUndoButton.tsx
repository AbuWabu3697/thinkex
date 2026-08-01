import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { useDocumentEditReceiptUndo } from "#/features/workspaces/documents/use-document-edit-receipt-undo";

/**
 * Undo, with a confirmation step because it throws away work the reader may
 * have asked for and only skimmed.
 */
export function DocumentEditUndoButton({
	className,
	itemId,
	receiptIds,
	workspaceId,
}: {
	className?: string;
	itemId: string;
	receiptIds: string[];
	workspaceId: string;
}) {
	const [isConfirming, setIsConfirming] = useState(false);
	const undoMutation = useDocumentEditReceiptUndo({ itemId, receiptIds, workspaceId });

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={className}
				disabled={undoMutation.isPending}
				onClick={() => setIsConfirming(true)}
			>
				{undoMutation.isPending ? (
					<LoaderCircle className="animate-spin" aria-hidden="true" />
				) : null}
				Undo
			</Button>
			<AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Undo these changes?</AlertDialogTitle>
						<AlertDialogDescription>
							The document goes back to how it was before the assistant edited it.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep changes</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								setIsConfirming(false);
								undoMutation.mutate();
							}}
						>
							Undo
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
