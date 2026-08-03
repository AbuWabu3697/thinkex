import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Switch } from "#/components/ui/switch";
import {
	ACCEPT_ALL,
	type ConsentCategories,
	getStoredConsent,
	REJECT_ALL,
	setStoredConsent,
	subscribeToConsentOpen,
} from "#/integrations/posthog/consent";
import { useConsent } from "#/integrations/posthog/use-consent";

/**
 * Cookie/analytics consent surface. Shows a banner until the user chooses, and a
 * "Manage cookies" dialog (also openable from the footer). Rendered inside
 * PostHogProvider, so it only mounts when analytics are configured at all.
 */
export function ConsentManager() {
	const consent = useConsent();
	const [managerOpen, setManagerOpen] = useState(false);
	const [draft, setDraft] = useState<ConsentCategories>(ACCEPT_ALL);

	useEffect(() => {
		return subscribeToConsentOpen(() => {
			const current = getStoredConsent();
			setDraft(current ?? ACCEPT_ALL);
			setManagerOpen(true);
		});
	}, []);

	function decide(categories: ConsentCategories) {
		setStoredConsent(categories);
		setManagerOpen(false);
	}

	function openManager() {
		setDraft(consent ?? ACCEPT_ALL);
		setManagerOpen(true);
	}

	const bannerVisible = consent === null && !managerOpen;

	return (
		<>
			{bannerVisible ? (
				<ConsentBanner
					onAccept={() => decide(ACCEPT_ALL)}
					onReject={() => decide(REJECT_ALL)}
					onManage={openManager}
				/>
			) : null}

			<Dialog open={managerOpen} onOpenChange={setManagerOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cookie preferences</DialogTitle>
						<DialogDescription>
							Choose what ThinkEx may measure. Sign-in and security cookies are always on — they're
							required for the app to work. See our{" "}
							<Link to="/cookies" className="underline underline-offset-4">
								Cookie Policy
							</Link>
							.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-1">
						<ConsentRow
							title="Strictly necessary"
							description="Keeps you signed in and secure. Always active."
							checked
							disabled
						/>
						<ConsentRow
							title="Product analytics"
							description="Usage and error diagnostics so we can fix bugs and improve ThinkEx."
							checked={draft.analytics}
							onCheckedChange={(analytics) =>
								setDraft((prev) => ({
									analytics,
									// Replay can't run without analytics.
									sessionReplay: analytics && prev.sessionReplay,
								}))
							}
						/>
						<ConsentRow
							title="Session replay"
							description="Records session playback with inputs and text masked to debug issues. Requires analytics."
							checked={draft.sessionReplay}
							disabled={!draft.analytics}
							onCheckedChange={(sessionReplay) => setDraft((prev) => ({ ...prev, sessionReplay }))}
						/>
					</div>

					<DialogFooter layout="split">
						<Button variant="outline" onClick={() => decide(REJECT_ALL)}>
							Reject all
						</Button>
						<Button onClick={() => decide(draft)}>Save preferences</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function ConsentBanner({
	onAccept,
	onReject,
	onManage,
}: {
	onAccept: () => void;
	onReject: () => void;
	onManage: () => void;
}) {
	return (
		<div
			role="region"
			aria-label="Cookie consent"
			className="fixed bottom-4 left-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-200 animate-in fade-in-0 slide-in-from-bottom-4"
		>
			<p className="text-sm text-muted-foreground">
				We use cookies for analytics and session replay to improve ThinkEx. Sign-in cookies are
				always required.{" "}
				<Link to="/cookies" className="underline underline-offset-4 hover:text-foreground">
					Cookie Policy
				</Link>
			</p>
			<div className="mt-3 flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={onManage}
					className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
				>
					Manage
				</button>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={onReject}>
						Reject
					</Button>
					<Button size="sm" onClick={onAccept}>
						Accept
					</Button>
				</div>
			</div>
		</div>
	);
}

function ConsentRow({
	title,
	description,
	checked,
	disabled,
	onCheckedChange,
}: {
	title: string;
	description: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange?: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4 border-b py-4 last:border-b-0">
			<div className="grid gap-1">
				<p className="text-sm font-medium text-foreground">{title}</p>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			<Switch
				checked={checked}
				disabled={disabled}
				onCheckedChange={onCheckedChange}
				aria-label={title}
				className="mt-0.5"
			/>
		</div>
	);
}
