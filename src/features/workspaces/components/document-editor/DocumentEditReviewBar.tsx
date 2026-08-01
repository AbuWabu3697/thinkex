import { Sparkles } from "lucide-react";

import { Button } from "#/components/ui/button";
import { useDocumentEditReview } from "#/features/workspaces/documents/document-edit-review-context";

export function DocumentEditReviewBar({
	itemId,
	viewInstanceId,
}: {
	itemId: string;
	viewInstanceId: string;
}) {
	const { activeReview, hideReview } = useDocumentEditReview();

	if (activeReview?.itemId !== itemId || activeReview.viewInstanceId !== viewInstanceId) {
		return null;
	}

	return (
		<div
			aria-label="AI change review"
			className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border bg-background/95 py-1 pr-1 pl-2.5 text-muted-foreground text-xs shadow-sm backdrop-blur"
			role="toolbar"
		>
			<Sparkles className="size-3.5 text-blue-500" aria-hidden="true" />
			<span className="font-medium text-foreground/80">AI changes</span>
			<Button type="button" variant="ghost" size="xs" onClick={hideReview}>
				Done
			</Button>
		</div>
	);
}
