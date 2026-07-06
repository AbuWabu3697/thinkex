import { Link } from "@tanstack/react-router";

import { FEATURES_SECTION_ID, PRICING_SECTION_ID } from "#/components/landing/landing-sections";
import { PublicSectionLink } from "#/components/PublicSectionLink";

type PublicNavLinksProps = {
	className?: string;
	linkClassName?: string;
};

const linkClassName =
	"text-sm font-normal text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

const navLinks = [
	{ label: "Features", sectionId: FEATURES_SECTION_ID },
	{ label: "Pricing", sectionId: PRICING_SECTION_ID },
	{ label: "Blog", to: "/blog" },
] as const;

export function PublicNavLinks({
	className,
	linkClassName: extraLinkClassName,
}: PublicNavLinksProps) {
	const classes = extraLinkClassName ? `${linkClassName} ${extraLinkClassName}` : linkClassName;

	return (
		<div className={className}>
			{navLinks.map((link) =>
				"to" in link ? (
					<Link key={link.label} to={link.to} className={classes}>
						{link.label}
					</Link>
				) : (
					<PublicSectionLink key={link.label} sectionId={link.sectionId} className={classes}>
						{link.label}
					</PublicSectionLink>
				),
			)}
		</div>
	);
}
