import { DatabaseSync } from "node:sqlite";

import { expect, it } from "vitest";

import type { WorkspaceKernelSql } from "#/features/workspaces/kernel/workspace-kernel-schema";
import { initializeWorkspaceSearchStorage } from "#/features/workspaces/search/workspace-search-schema";

it("upgrades vector deletion storage created before attempts existed", () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE kernel_meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE TABLE kernel_search_vector_deletes (
			vector_id TEXT PRIMARY KEY,
			requested_at INTEGER NOT NULL
		);
		INSERT INTO kernel_search_vector_deletes (vector_id, requested_at)
		VALUES ('stale-vector', 1);
	`);

	const sql = createSql(database);
	initializeWorkspaceSearchStorage(sql);
	initializeWorkspaceSearchStorage(sql);

	const row = database
		.prepare("SELECT attempts FROM kernel_search_vector_deletes WHERE vector_id = ?")
		.get("stale-vector");
	expect(row).toEqual({ attempts: 0 });
	database.close();
});

function createSql(database: DatabaseSync): WorkspaceKernelSql {
	return <T>(strings: TemplateStringsArray, ...values: (string | number | boolean | null)[]) => {
		const query = strings.reduce(
			(result, part, index) => result + (index === 0 ? "" : "?") + part,
			"",
		);
		const sqliteValues = values.map((value) =>
			typeof value === "boolean" ? Number(value) : value,
		);
		return database.prepare(query).all(...sqliteValues) as T[];
	};
}
