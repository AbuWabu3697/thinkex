import { PublicHeader } from "#/components/PublicHeader";
import SiteFooter from "#/components/SiteFooter";

type BlogShellProps = {
	children: React.ReactNode;
};

export function BlogShell({ children }: BlogShellProps) {
	return (
		<div
			data-app-shell
			className="flex min-h-screen flex-col bg-background text-foreground dark:bg-black"
		>
			<PublicHeader />

			<main className="flex-1">{children}</main>
			<SiteFooter />
		</div>
	);
}
