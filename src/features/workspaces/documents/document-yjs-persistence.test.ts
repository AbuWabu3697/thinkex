import { describe, expect, it } from "vitest";

import {
	readPersistedDocumentYjsUpdate,
	writePersistedDocumentYjsUpdate,
} from "#/features/workspaces/documents/document-yjs-persistence";

const manifestKey = "document-session:yjs-update";
const partKeyPrefix = "document-session:yjs-update-part:";

describe("document Yjs persistence", () => {
	it("reads legacy single-value updates", async () => {
		const memory = createMemoryStorage();
		const update = new Uint8Array([1, 2, 3]);
		memory.values.set(manifestKey, update);

		await expect(readPersistedDocumentYjsUpdate(memory.storage)).resolves.toEqual(update);
	});

	it("round-trips multipart updates and removes the previous generation", async () => {
		const memory = createMemoryStorage();
		const largeUpdate = new Uint8Array(2_500_000).map((_, index) => index % 251);

		await writePersistedDocumentYjsUpdate(memory.transaction, largeUpdate);
		await expect(readPersistedDocumentYjsUpdate(memory.storage)).resolves.toEqual(largeUpdate);
		expect(getPartKeys(memory.values)).toHaveLength(3);

		const replacement = new Uint8Array([4, 5, 6]);
		await writePersistedDocumentYjsUpdate(memory.transaction, replacement);
		await expect(readPersistedDocumentYjsUpdate(memory.storage)).resolves.toEqual(replacement);
		expect(getPartKeys(memory.values)).toHaveLength(1);
	});
});

function createMemoryStorage() {
	const values = new Map<string, unknown>();
	const get = async (keyOrKeys: string | string[]) => {
		if (typeof keyOrKeys === "string") {
			return values.get(keyOrKeys);
		}
		return new Map(
			keyOrKeys.flatMap((key) => (values.has(key) ? [[key, values.get(key)] as const] : [])),
		);
	};
	const put = async (key: string, value: unknown) => {
		values.set(key, value);
	};
	const remove = async (keyOrKeys: string | string[]) => {
		const keys = typeof keyOrKeys === "string" ? [keyOrKeys] : keyOrKeys;
		for (const key of keys) {
			values.delete(key);
		}
		return keys.length;
	};
	const methods = { delete: remove, get, put };

	return {
		storage: methods as unknown as DurableObjectStorage,
		transaction: methods as unknown as DurableObjectTransaction,
		values,
	};
}

function getPartKeys(values: ReadonlyMap<string, unknown>) {
	return [...values.keys()].filter((key) => key.startsWith(partKeyPrefix));
}
