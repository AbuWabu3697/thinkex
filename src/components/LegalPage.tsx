import { Link } from "@tanstack/react-router";

import { ModeToggle } from "#/components/mode-toggle";
import SiteFooter from "#/components/SiteFooter";
import ThinkExLogo from "#/components/ThinkExLogo";
import { Button } from "#/components/ui/button";

export const LEGAL_LAST_UPDATED = "July 2, 2026";

type LegalSection = {
	title: string;
	body?: string;
	items?: string[];
};

export type LegalDocument = {
	title: string;
	description: string;
	sections: LegalSection[];
};

export function LegalPage({ document }: { document: LegalDocument }) {
	return (
		<div
			data-app-shell
			className="flex min-h-screen flex-col bg-background text-foreground dark:bg-black"
		>
			<header className="border-b border-border bg-background dark:bg-black">
				<div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-6">
					<Link
						to="/"
						className="flex items-center gap-3 rounded-md text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ThinkExLogo size={28} />
						<span className="text-xl font-semibold tracking-tight sm:text-2xl">ThinkEx</span>
					</Link>
					<nav className="ml-auto flex items-center gap-2" aria-label="Legal page controls">
						<ModeToggle className="size-9" />
						<Button nativeButton={false} render={<Link to="/login" />} variant="outline">
							Sign in
						</Button>
					</nav>
				</div>
			</header>

			<main className="flex-1">
				<article className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
					<p className="text-sm font-medium text-muted-foreground">
						Last updated {LEGAL_LAST_UPDATED}
					</p>
					<h1 className="mt-3 text-4xl font-medium tracking-tight text-balance sm:text-5xl">
						{document.title}
					</h1>
					<p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
						{document.description}
					</p>

					<div className="mt-10 space-y-9">
						{document.sections.map((section) => (
							<section key={section.title} className="space-y-3">
								<h2 className="text-xl font-medium tracking-tight">{section.title}</h2>
								{section.body ? (
									<p className="text-sm leading-7 text-muted-foreground">{section.body}</p>
								) : null}
								{section.items ? (
									<ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
										{section.items.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								) : null}
							</section>
						))}
					</div>
				</article>
			</main>

			<SiteFooter />
		</div>
	);
}
