const persistedDocumentYjsUpdateKey = "document-session:yjs-update";
const persistedDocumentYjsPartKeyPrefix = "document-session:yjs-update-part:";
// Keep reconstructed state comfortably below the Worker isolate limit, and
// each stored value comfortably below Durable Object storage's 2 MB ceiling.
const maximumPersistedDocumentYjsBytes = 16 * 1024 * 1024;
const maximumPersistedDocumentYjsPartBytes = 1024 * 1024;

interface PersistedDocumentYjsManifest {
	generation: string;
	partCount: number;
	totalBytes: number;
	version: 1;
}

export async function readPersistedDocumentYjsUpdate(storage: DurableObjectStorage) {
	const stored = await storage.get<Uint8Array | PersistedDocumentYjsManifest>(
		persistedDocumentYjsUpdateKey,
	);
	if (!stored || stored instanceof Uint8Array) {
		return stored;
	}
	if (!isPersistedDocumentYjsManifest(stored)) {
		throw new Error("Persisted document state manifest is invalid.");
	}

	const keys = getPersistedDocumentYjsPartKeys(stored);
	const parts = await storage.get<Uint8Array>(keys);
	const update = new Uint8Array(stored.totalBytes);
	let offset = 0;

	for (const key of keys) {
		const part = parts.get(key);
		if (!(part instanceof Uint8Array) || offset + part.byteLength > update.byteLength) {
			throw new Error("Persisted document state is incomplete.");
		}
		update.set(part, offset);
		offset += part.byteLength;
	}

	if (offset !== update.byteLength) {
		throw new Error("Persisted document state size does not match its manifest.");
	}

	return update;
}

export async function writePersistedDocumentYjsUpdate(
	transaction: DurableObjectTransaction,
	update: Uint8Array,
) {
	if (update.byteLength > maximumPersistedDocumentYjsBytes) {
		throw new Error("Document is too large to persist safely.");
	}

	const previous = await transaction.get<Uint8Array | PersistedDocumentYjsManifest>(
		persistedDocumentYjsUpdateKey,
	);
	const manifest: PersistedDocumentYjsManifest = {
		generation: crypto.randomUUID(),
		partCount: Math.max(1, Math.ceil(update.byteLength / maximumPersistedDocumentYjsPartBytes)),
		totalBytes: update.byteLength,
		version: 1,
	};
	const keys = getPersistedDocumentYjsPartKeys(manifest);

	await Promise.all(
		keys.map((key, index) => {
			const start = index * maximumPersistedDocumentYjsPartBytes;
			return transaction.put(
				key,
				update.slice(start, start + maximumPersistedDocumentYjsPartBytes),
			);
		}),
	);
	await transaction.put(persistedDocumentYjsUpdateKey, manifest);

	if (isPersistedDocumentYjsManifest(previous)) {
		await transaction.delete(getPersistedDocumentYjsPartKeys(previous));
	}
}

function getPersistedDocumentYjsPartKeys(manifest: PersistedDocumentYjsManifest) {
	return Array.from(
		{ length: manifest.partCount },
		(_, index) => `${persistedDocumentYjsPartKeyPrefix}${manifest.generation}:${index}`,
	);
}

function isPersistedDocumentYjsManifest(
	value: Uint8Array | PersistedDocumentYjsManifest | undefined,
): value is PersistedDocumentYjsManifest {
	return (
		value !== undefined &&
		!(value instanceof Uint8Array) &&
		value.version === 1 &&
		typeof value.generation === "string" &&
		value.generation.length > 0 &&
		value.generation.length <= 64 &&
		Number.isInteger(value.partCount) &&
		Number.isInteger(value.totalBytes) &&
		value.totalBytes >= 0 &&
		value.totalBytes <= maximumPersistedDocumentYjsBytes &&
		value.partCount ===
			Math.max(1, Math.ceil(value.totalBytes / maximumPersistedDocumentYjsPartBytes))
	);
}
