import { describe, expect, it } from "vitest";

import type {
	WorkspaceItemSummary,
	WorkspacePage,
	WorkspaceSummary,
} from "#/features/workspaces/contracts";
import {
	buildWorkspaceExportEntries,
	buildWorkspaceExportPathIndex,
	extractTextFromHtml,
	reconstructWorkspaceState,
	sanitizeExportName,
} from "./workspace-export";
import { createZipArchive } from "./workspace-zip";

describe("workspace export helpers", () => {
	it("replays events after a snapshot in chronological order", () => {
		const page = createPage({
			items: [
				createItem({
					id: "doc",
					name: "Draft",
					sortOrder: 1000,
					type: "document",
				}),
				createItem({
					id: "folder",
					name: "Folder",
					sortOrder: 2000,
					type: "folder",
				}),
			],
			revision: 1,
		});

		const moved = createItem({
			id: "doc",
			name: "Final",
			parentId: "folder",
			sortOrder: 1000,
			type: "document",
		});
		const result = reconstructWorkspaceState({
			snapshot: page,
			eventsAfterSnapshot: [
				{
					actorUserId: "user",
					clientMutationId: null,
					createdAt: "2026-07-28T00:00:02.000Z",
					id: "event-2",
					payload: { items: [moved] },
					revision: 3,
					type: "workspace.items.moved",
					workspaceId: "workspace",
				},
				{
					actorUserId: "user",
					clientMutationId: null,
					createdAt: "2026-07-28T00:00:01.000Z",
					id: "event-1",
					payload: {
						item: createItem({
							id: "doc",
							name: "Final",
							sortOrder: 1000,
							type: "document",
						}),
					},
					revision: 2,
					type: "workspace.item.renamed",
					workspaceId: "workspace",
				},
			],
		});

		expect(result.revision).toBe(3);
		expect(result.items.find((item) => item.id === "doc")).toMatchObject({
			name: "Final",
			parentId: "folder",
		});
	});

	it("creates nested, collision-safe export paths", () => {
		const paths = buildWorkspaceExportPathIndex("My Workspace", [
			createItem({ id: "folder", name: "Biology", sortOrder: 1000, type: "folder" }),
			createItem({
				id: "doc-a",
				name: "Cell Notes",
				parentId: "folder",
				sortOrder: 1000,
				type: "document",
			}),
			createItem({
				id: "doc-b",
				name: "Cell Notes",
				parentId: "folder",
				sortOrder: 2000,
				type: "document",
			}),
			createItem({
				id: "unsafe",
				name: "../bad:name*",
				parentId: "folder",
				sortOrder: 3000,
				type: "file",
			}),
		]);

		expect(paths.get("doc-a")).toBe("My Workspace/Biology/Cell Notes");
		expect(paths.get("doc-b")).toBe("My Workspace/Biology/Cell Notes (1)");
		expect(paths.get("unsafe")).toBe("My Workspace/Biology/_bad_name_");
	});

	it("sanitizes empty and unsafe names", () => {
		expect(sanitizeExportName("")).toBe("Untitled");
		expect(sanitizeExportName("..")).toBe("Untitled");
		expect(sanitizeExportName('Chapter: 1 / "Draft"')).toBe("Chapter_ 1 _ _Draft_");
	});

	it("represents empty folders in the zip", () => {
		const zip = createZipArchive([{ path: "Workspace/" }, { path: "Workspace/Empty/" }]);
		const text = new TextDecoder().decode(zip);

		expect(text).toContain("Workspace/Empty/");
		expect(zip[0]).toBe(0x50);
		expect(zip[1]).toBe(0x4b);
	});

	it("adds a notice entry when a file source is missing", async () => {
		const page = createPage({
			items: [
				createItem({
					id: "missing-file",
					name: "Lecture.pdf",
					sortOrder: 1000,
					type: "file",
				}),
			],
			revision: 1,
		});
		const entries = await buildWorkspaceExportEntries(
			createEnv(),
			{
				getFileSource: async () => {
					throw new Error("Workspace file source object is missing.");
				},
			} as never,
			page,
		);
		const notice = entries.find((entry) => entry.path.endsWith(".missing.txt"));

		expect(notice).toMatchObject({ path: "My Workspace/Lecture.pdf.missing.txt" });
		expect(new TextDecoder().decode(notice?.data as Uint8Array)).toContain(
			'The file "Lecture.pdf" could not be included in this export.',
		);
	});

	it("removes generated CSS when extracting fallback PDF text", () => {
		const text = extractTextFromHtml(`<!doctype html>
<html>
<head>
<title>New document 1</title>
<style>
@page { size: Letter; margin: 0.75in; }
body { color: #111827; }
</style>
</head>
<body>
<main><p>test</p></main>
</body>
</html>`);

		expect(text).toBe("test");
	});
});

function createPage(input: { items: WorkspaceItemSummary[]; revision: number }): WorkspacePage {
	return {
		itemFacts: [],
		items: input.items,
		revision: input.revision,
		workspace: createWorkspace(),
	};
}

function createWorkspace(): WorkspaceSummary {
	return {
		archivedAt: null,
		color: null,
		createdAt: "2026-07-28T00:00:00.000Z",
		description: null,
		icon: null,
		id: "workspace",
		lastOpenedAt: null,
		membershipRole: "owner",
		name: "My Workspace",
		updatedAt: "2026-07-28T00:00:00.000Z",
	};
}

function createEnv() {
	return {
		WORKSPACE_KERNEL_FILES: {
			get: async () => null,
		},
	} as never;
}

function createItem(input: {
	id: string;
	name: string;
	parentId?: string | null;
	sortOrder: number;
	type: WorkspaceItemSummary["type"];
}): WorkspaceItemSummary {
	return {
		color: null,
		createdAt: "2026-07-28T00:00:00.000Z",
		deletedAt: null,
		id: input.id,
		meta: input.type,
		metadataJson: {},
		name: input.name,
		parentId: input.parentId ?? null,
		sortOrder: input.sortOrder,
		title: input.name,
		type: input.type,
		updatedAt: "2026-07-28T00:00:00.000Z",
		workspaceId: "workspace",
	};
}
