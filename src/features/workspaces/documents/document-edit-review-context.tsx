import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";

import { useWorkspaceLocationActions } from "#/features/workspaces/locations/workspace-location-context";

export interface ActiveDocumentEditReview {
	itemId: string;
	receiptIds: string[];
	viewInstanceId: string;
}

interface DocumentEditReviewContextValue {
	activeReview: ActiveDocumentEditReview | null;
	endReviewForView: (input: { itemId: string; viewInstanceId: string }) => void;
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
	/**
	 * Ends review only if it still belongs to the given view. A closing view
	 * cannot just clear the review outright: opening a second document unmounts
	 * the first, and that teardown would otherwise wipe the review that was just
	 * opened for the new one.
	 */
	const endReviewForView = useCallback((input: { itemId: string; viewInstanceId: string }) => {
		setActiveReview((current) =>
			current?.itemId === input.itemId && current.viewInstanceId === input.viewInstanceId
				? null
				: current,
		);
	}, []);
	const showReview = useCallback(
		(input: { itemId: string; receiptIds: string[] }) => {
			const viewInstanceId = reveal({ itemId: input.itemId, kind: "item", version: 1 });
			if (!viewInstanceId) {
				return false;
			}

			setActiveReview({
				itemId: input.itemId,
				receiptIds: input.receiptIds,
				viewInstanceId,
			});
			return true;
		},
		[reveal],
	);
	const value = useMemo(
		() => ({ activeReview, endReviewForView, hideReview, showReview, workspaceId }),
		[activeReview, endReviewForView, hideReview, showReview, workspaceId],
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
