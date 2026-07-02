import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalDocument } from "#/components/LegalPage";
import { buildPublicMeta } from "#/lib/seo";

const cookieDocument = {
	title: "Cookie Policy",
	description:
		"This policy explains how ThinkEx Inc. uses cookies and browser storage to keep the app signed in, secure, personalized, and measurable.",
	sections: [
		{
			title: "Who we are",
			body: 'This policy is provided by ThinkEx Inc. ("ThinkEx," "we," "us," and "our").',
		},
		{
			title: "What cookies and browser storage are",
			body: "Cookies are small files stored by your browser. Browser storage includes local storage and similar technologies that let a web app remember state on your device. ThinkEx uses both.",
		},
		{
			title: "Required cookies",
			body: "ThinkEx uses required cookies and related storage for sign-in, session management, guest accounts, security, request handling, and account deletion verification. Blocking these cookies may prevent login, workspace access, sharing, or other core features from working.",
		},
		{
			title: "Preference storage",
			body: "ThinkEx uses browser storage to remember choices such as theme, workspace view state, selected AI model, chat panel state, active workspace panes, and other UI preferences. These values help the app feel consistent across visits on the same browser.",
		},
		{
			title: "Analytics and diagnostics",
			body: "Where configured, ThinkEx uses PostHog and related browser storage to understand product usage, collect feedback, diagnose errors, measure AI/tool activity, and support session replay in deployed builds. Local development disables or limits some analytics behavior unless explicitly enabled.",
		},
		{
			title: "Email, auth, and provider interactions",
			body: "Third-party services used for sign-in, analytics, feedback, AI, extraction, web research, email delivery, hosting, and security may set or read their own cookies or similar technologies when you interact with them through ThinkEx or leave ThinkEx for their websites.",
		},
		{
			title: "Managing cookies",
			items: [
				"You can delete or block cookies and local storage through your browser settings.",
				"Blocking required cookies can break authentication, account security, and workspace access.",
				"Blocking analytics or third-party storage may reduce measurement, feedback, and diagnostic features but should not prevent normal workspace use unless your browser blocks required app storage too.",
			],
		},
		{
			title: "Changes",
			body: "We may update this Cookie Policy when our product, providers, or storage practices change.",
		},
		{
			title: "Contact",
			body: "Questions about cookies can be sent to hello@thinkex.app.",
		},
	],
} satisfies LegalDocument;

export const Route = createFileRoute("/cookies")({
	head: () => ({
		meta: buildPublicMeta({
			title: "Cookie Policy",
			description: cookieDocument.description,
		}),
	}),
	component: CookiesPage,
});

function CookiesPage() {
	return <LegalPage document={cookieDocument} />;
}
