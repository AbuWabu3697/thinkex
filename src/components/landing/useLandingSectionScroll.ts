import { useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";

import {
	getLandingSectionId,
	scrollLandingSectionIntoView,
} from "#/components/landing/landing-sections";

export function useLandingSectionScroll() {
	const hash = useRouterState({ select: (state) => state.location.hash });
	const sectionId =
		getLandingSectionId(hash) ??
		(typeof window === "undefined" ? null : getLandingSectionId(window.location.hash));
	const scrollRootRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		if (!sectionId) {
			return;
		}

		if (!scrollRootRef.current) {
			return;
		}

		scrollLandingSectionIntoView(sectionId);
	}, [sectionId]);

	return scrollRootRef;
}
