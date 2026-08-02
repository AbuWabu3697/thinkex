import { env } from "cloudflare:test";
import { runInDurableObject } from "cloudflare:test";
import { getAgentByName } from "agents";
import { describe, expect, it } from "vitest";

import type { UserAIStore } from "#/features/workspaces/ai/user-ai-agents";
import type { ResourcePurgeResult } from "#/features/workspaces/resource-purge-result";

// The generated recursive Agent stub exceeds TypeScript's instantiation depth,
// so narrow the binding the way the lifecycle helpers do.
interface TestUserAIStore {
	purgeForDeletion(): Promise<ResourcePurgeResult>;
}

describe("user AI store purge", () => {
	it("refuses queries on the live instance instead of reading a dropped schema", async () => {
		const namespace = Reflect.get(env as object, "UserAIStore") as DurableObjectNamespace;
		const userId = "purge-live-instance";

		// This DO builds its schema in onStart rather than its constructor, so it
		// has to be reached through the agent bootstrap. A raw stub skips it.
		const agent = (await getAgentByName(namespace as never, userId)) as unknown as TestUserAIStore;
		const purge = await agent.purgeForDeletion();
		expect(purge.failed).toBe(0);

		// The purge empties storage without evicting the instance, so this runs
		// against the same object whose schema setup already ran.
		const stub = namespace.get(namespace.idFromName(userId)) as DurableObjectStub<UserAIStore>;
		await runInDurableObject(stub, async (store: UserAIStore) => {
			await expect(store.purgeForDeletion()).rejects.toThrow("Account deleted.");
		});
	});
});
