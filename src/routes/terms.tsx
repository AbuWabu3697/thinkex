import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalDocument } from "#/components/LegalPage";
import { buildPublicMeta } from "#/lib/seo";

const termsDocument = {
	title: "Terms of Service",
	description:
		"These terms govern your access to ThinkEx Inc. and your use of its workspace, document, file, sharing, AI, research, and collaboration features.",
	sections: [
		{
			title: "Who these terms are with",
			body: 'These terms are an agreement between you and ThinkEx Inc. ("ThinkEx," "we," "us," and "our").',
		},
		{
			title: "Using ThinkEx",
			body: "You may use ThinkEx only if you can form a binding agreement or are using it with permission from a parent, guardian, school, employer, or other organization responsible for your use. You are responsible for your account, your workspace activity, and the content you add to ThinkEx.",
		},
		{
			title: "Accounts and access",
			items: [
				"You may sign in with Google or use a guest account where available.",
				"You must provide accurate account information and keep access to your account secure.",
				"You are responsible for invites you send and for workspace access you grant to collaborators.",
				"We may suspend or restrict access if we believe an account is being misused, presents security risk, or violates these terms.",
			],
		},
		{
			title: "Your content",
			body: "You keep ownership of documents, files, notes, prompts, and other content you add to ThinkEx. You give ThinkEx the limited permission needed to host, store, copy, render, convert, extract, transmit, display, and process that content so the service can work, including through AI, file-conversion, extraction, search, sharing, and collaboration features you choose to use.",
		},
		{
			title: "AI features",
			items: [
				"AI outputs may be incomplete, inaccurate, or unsuitable for your situation. Review important work yourself.",
				"Do not rely on ThinkEx as a substitute for professional legal, medical, financial, or safety advice.",
				"AI tools may read selected workspace context, browse public web pages, run private code, or create and edit workspace items when you enable those actions.",
				"You are responsible for prompts, inputs, files, tool instructions, and decisions made using AI outputs.",
			],
		},
		{
			title: "Acceptable use",
			items: [
				"Do not upload or share content you do not have the right to use.",
				"Do not use ThinkEx to violate laws, infringe rights, harass others, distribute malware, send spam, or bypass security controls.",
				"Do not attempt to access another user's account, workspace, files, sessions, systems, or data without permission.",
				"Do not overload, scrape, reverse engineer, or interfere with ThinkEx except as allowed by law or by written permission from us.",
			],
		},
		{
			title: "Third-party services",
			body: "ThinkEx depends on third-party services for hosting, authentication, analytics, email, file conversion, extraction, AI models, web research, and usage tracking. Their services may be subject to their own terms and privacy notices. We are not responsible for third-party websites or services that are not controlled by ThinkEx.",
		},
		{
			title: "Changes and availability",
			body: "We may change, suspend, or discontinue features, limits, providers, models, or access paths as ThinkEx evolves. We may update these terms by posting a new version on this page. Continued use after an update means you accept the updated terms.",
		},
		{
			title: "Termination and deletion",
			body: "You may stop using ThinkEx at any time. You can request account deletion from settings. Deleting your account removes your account resources and purges workspaces you own, including their items and files, subject to limited operational, security, legal, provider, backup, or analytics retention.",
		},
		{
			title: "Disclaimers and limits",
			body: "ThinkEx is provided as is and as available. To the maximum extent allowed by law, ThinkEx disclaims warranties and will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost data, profits, goodwill, or business opportunities.",
		},
		{
			title: "Contact",
			body: "Questions about these terms can be sent to hello@thinkex.app.",
		},
	],
} satisfies LegalDocument;

export const Route = createFileRoute("/terms")({
	head: () => ({
		meta: buildPublicMeta({
			title: "Terms of Service",
			description: termsDocument.description,
		}),
	}),
	component: TermsPage,
});

function TermsPage() {
	return <LegalPage document={termsDocument} />;
}
