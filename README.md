<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/thinkex-filled-ascii-wordmark-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/thinkex-filled-ascii-wordmark-light.svg">
    <img alt="ThinkEx" src="docs/assets/thinkex-filled-ascii-wordmark-light.svg" width="430">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/ThinkEx-OSS/thinkex/stargazers"><img alt="GitHub stars" src="https://shieldcn.dev/github/stars/ThinkEx-OSS/thinkex.svg?variant=secondary&size=sm&theme=amber"></a>
  <a href="https://x.com/trythinkex"><img alt="X" src="https://shieldcn.dev/badge/X-follow-000000.svg?variant=secondary&size=sm&logo=x"></a>
  <a href="https://discord.gg/dtPnzkqCcG"><img alt="Discord" src="https://shieldcn.dev/badge/Discord-join-5865f2.svg?variant=secondary&size=sm&logo=discord"></a>
</p>

<p align="center">
  <strong>The workspace built for how you study, research, and create.</strong>
</p>

<p align="center">
  <img alt="ThinkEx workspace with documents, folders, and AI assistant" src="docs/assets/landing-workspace-screenshot.webp" width="900">
</p>

## When a Chat Thread Is Not Enough

ThinkEx is a workspace for source-heavy study and research.

Instead of uploading sources into a chat, you keep the actual materials in view: PDFs, docs, images, folders, and AI chat. Arrange them, pick what the AI should use, and keep the answer tied to the workspace where the work is happening.

- Open PDFs, documents, images, and folders in a workspace.
- Put sources side by side while you read or compare them.
- Ask AI about the specific items you choose.
- Share a workspace with collaborators (fellow humans).

## How It Is Different

| Compared with           | What they are good at                    | Where ThinkEx differs                                     |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------- |
| ChatGPT, Claude, Gemini | Fast AI conversations                    | Chat is part of the workspace, next to sources and docs   |
| NotebookLM              | Asking questions over uploaded sources   | Sources stay open, arrangeable, editable, and shareable   |
| Obsidian                | Markdown files and local knowledge bases | PDFs, images, docs, AI chat, and sharing are first-class  |
| Google Drive, Dropbox   | Storing and sharing files                | Files become source material with docs and AI beside them |

## What's In This Repo

This is the current ThinkEx web app. It uses React, TanStack Start, TypeScript, Tailwind CSS, Better Auth, Drizzle, Tiptap, Yjs/PartyServer, EmbedPDF/PDFium, and Cloudflare Workers.

Most product code lives in [`src/features/workspaces/`](src/features/workspaces/). Runtime and deployment configuration lives in [`wrangler.jsonc`](wrangler.jsonc), with database migrations in [`drizzle/`](drizzle/).

For deeper implementation details, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

## Local Development

With Infisical:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Without Infisical, you can run with `.dev.vars`:

```bash
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm serve:dev
```

The app runs at [http://localhost:3000](http://localhost:3000). Only `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required for the core local app; optional secrets unlock features such as AI chat, browsing, and email.

Useful commands:

- `pnpm serve:dev` starts the local dev server with existing environment variables or `.dev.vars`.
- `pnpm db:migrate:local` applies local D1 migrations before first database use.
- `pnpm check` runs the fast TypeScript/lint validation.
- `pnpm verify` runs the full validation suite.

Local caveats:

- Node `>=22.18` is required.
- Docker must be running because the app declares Cloudflare Container bindings.
- If you are not logged into Cloudflare locally, run with `CLOUDFLARE_VITE_FORCE_LOCAL=true pnpm serve:dev`.

## Contributing

Issues and pull requests are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), keep changes focused, and run `pnpm verify` before opening a PR when possible.

## License

ThinkEx is licensed under the [AGPL-3.0 License](LICENSE).
