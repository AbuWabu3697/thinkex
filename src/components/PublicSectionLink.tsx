import { Link } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import {
	getLandingSectionId,
	landingSectionScrollOptions,
	scrollLandingSectionIntoView,
	type LandingSectionId,
} from "#/components/landing/landing-sections";
import { isPlainLeftClick } from "#/lib/plain-link-click";

type PublicSectionLinkProps = {
	children: React.ReactNode;
	className?: string;
	sectionId: LandingSectionId;
};

export function PublicSectionLink({ children, className, sectionId }: PublicSectionLinkProps) {
	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		if (
			!isPlainLeftClick(event) ||
			window.location.pathname !== "/" ||
			getLandingSectionId(window.location.hash) !== sectionId
		) {
			return;
		}

		event.preventDefault();
		scrollLandingSectionIntoView(sectionId);
	}

	return (
		<Link
			to="/"
			hash={sectionId}
			hashScrollIntoView={landingSectionScrollOptions}
			className={className}
			onClick={handleClick}
		>
			{children}
		</Link>
	);
}
