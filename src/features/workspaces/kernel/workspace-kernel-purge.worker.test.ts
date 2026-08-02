import { env } from "cloudflare:test";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { WorkspaceKernel } from "#/features/workspaces/kernel/workspace-kernel";

// The generated recursive Agent stub exceeds TypeScript's instantiation depth,
// so reach the binding the way workspace-kernel-access does.
function getKernelStub(workspaceId: string) {
	const namespace = Reflect.get(env as object, "WorkspaceKernel") as DurableObjectNamespace;

	return namespace.get(namespace.idFromName(workspaceId)) as DurableObjectStub<WorkspaceKernel>;
}

async function seedAndPurge(workspaceId: string) {
	const stub = getKernelStub(workspaceId);

	await runInDurableObject(stub, async (kernel: WorkspaceKernel) => {
		await kernel.createItem({ id: crypto.randomUUID(), type: "folder", name: "Notes" });
		const purge = await kernel.purgeForDeletion();

		expect(purge.failed).toBe(0);
	});

	return stub;
}

describe("workspace kernel purge", () => {
	it("refuses queries on the live instance instead of reading a dropped schema", async () => {
		const stub = await seedAndPurge("purge-live-instance");

		// The purge empties storage without evicting the instance, so this runs
		// against the same object whose constructor already created the schema.
		await runInDurableObject(stub, async (kernel: WorkspaceKernel) => {
			await expect(kernel.getPage()).rejects.toThrow("Workspace deleted.");
		});
	});

	it("rebuilds an empty schema once the purged instance is evicted", async () => {
		const stub = await seedAndPurge("purge-after-eviction");

		await evictDurableObject(stub);

		// A later request reconstructs the object, so queries see an empty schema
		// rather than failing on a missing table.
		await runInDurableObject(stub, async (kernel: WorkspaceKernel) => {
			await expect(kernel.getPage()).resolves.toMatchObject({ items: [] });
		});
	});
});
