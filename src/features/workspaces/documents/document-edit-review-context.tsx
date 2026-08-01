import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";

import { useWorkspaceLocationActions } from "#/features/workspaces/locations/workspace-location-context";

/**
 * Review belongs to the document, not to the view showing it. Tying it to a
 * view instance meant the review had to be opened after that view existed, and
 * every wherever-it-is-now question became a lifecycle problem.
 */
export interface ActiveDocumentEditReview {
	itemId: string;
	receiptIds: string[];
}

interface DocumentEditReviewContextValue {
	activeReview: ActiveDocumentEditReview | null;
	hideReview: () => void;
	showReview: (input: { itemId: string; receiptIds: string[] }) => boolean;
	workspaceId: string;
}

const DocumentEditReviewContext = createContext<DocumentEditReviewContextValue | null>(null);

export function DocumentEditReviewProvider({
	children,
	workspaceId,
}: {
	children: ReactNode;
	workspaceId: string;
}) {
	const { reveal } = useWorkspaceLocationActions();
	const [activeReview, setActiveReview] = useState<ActiveDocumentEditReview | null>(null);
	const hideReview = useCallback(() => setActiveReview(null), []);
	const showReview = useCallback(
		(input: { itemId: string; receiptIds: string[] }) => {
			// reveal opens the document, or focuses the tab already holding it, and
			// only fails when the item is gone.
			if (!reveal({ itemId: input.itemId, kind: "item", version: 1 })) {
				return false;
			}

			setActiveReview({ itemId: input.itemId, receiptIds: input.receiptIds });
			return true;
		},
		[reveal],
	);
	const value = useMemo(
		() => ({ activeReview, hideReview, showReview, workspaceId }),
		[activeReview, hideReview, showReview, workspaceId],
	);

	return <DocumentEditReviewContext value={value}>{children}</DocumentEditReviewContext>;
}

export function useDocumentEditReview() {
	const value = use(DocumentEditReviewContext);
	if (!value) {
		throw new Error("Document edit review requires a workspace shell.");
	}

	return value;
}
