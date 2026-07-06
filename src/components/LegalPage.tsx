import { PublicHeader } from "#/components/PublicHeader";
import SiteFooter from "#/components/SiteFooter";

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
			<PublicHeader />

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
