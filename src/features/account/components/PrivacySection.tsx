import { Link } from "@tanstack/react-router";

import {
	Item,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemSeparator,
	ItemTitle,
} from "#/components/ui/item";
import { Switch } from "#/components/ui/switch";
import { isPostHogEnabled } from "#/integrations/posthog/config";
import {
	type ConsentCategories,
	REJECT_ALL,
	setStoredConsent,
} from "#/integrations/posthog/consent";
import { applyConsentToPostHog } from "#/integrations/posthog/consent-posthog";
import { useConsent } from "#/integrations/posthog/use-consent";

/**
 * Privacy controls inside account settings. Signed-in users never see the
 * footer's "Cookie Preferences" link, so the same analytics/replay toggles live
 * here too. Unlike the first-visit banner, these apply immediately — no save step.
 */
export function PrivacySection() {
	const consent = useConsent();

	// No decision yet means opted out (nothing captured); show toggles as off.
	const current: ConsentCategories = consent
		? { analytics: consent.analytics, sessionReplay: consent.sessionReplay }
		: REJECT_ALL;

	function update(next: ConsentCategories) {
		applyConsentToPostHog(setStoredConsent(next));
	}

	return (
		<ItemGroup className="gap-0">
			{isPostHogEnabled ? (
				<>
					<Item size="sm" className="px-0">
						<ItemContent>
							<ItemTitle>Product analytics</ItemTitle>
							<ItemDescription>
								Anonymous usage and error diagnostics that help us fix bugs and improve ThinkEx.
							</ItemDescription>
						</ItemContent>
						<Switch
							checked={current.analytics}
							onCheckedChange={(analytics) =>
								update({ analytics, sessionReplay: analytics && current.sessionReplay })
							}
							aria-label="Product analytics"
						/>
					</Item>

					<Item size="sm" className="px-0">
						<ItemContent>
							<ItemTitle>Session replay</ItemTitle>
							<ItemDescription>
								Anonymized session playback with all inputs and text masked, used to debug issues.
								Requires analytics.
							</ItemDescription>
						</ItemContent>
						<Switch
							checked={current.sessionReplay}
							disabled={!current.analytics}
							onCheckedChange={(sessionReplay) =>
								update({ analytics: current.analytics, sessionReplay })
							}
							aria-label="Session replay"
						/>
					</Item>

					<ItemSeparator className="my-0" />
				</>
			) : null}

			<Item size="sm" className="px-0">
				<ItemContent>
					<ItemTitle className="font-normal text-muted-foreground">Policies</ItemTitle>
				</ItemContent>
				<div className="flex items-center gap-4 text-sm">
					<Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
						Privacy
					</Link>
					<Link to="/cookies" className="underline underline-offset-4 hover:text-foreground">
						Cookies
					</Link>
				</div>
			</Item>
		</ItemGroup>
	);
}
