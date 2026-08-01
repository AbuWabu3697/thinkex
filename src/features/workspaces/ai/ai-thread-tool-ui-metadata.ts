const aiThreadToolUiMetadataKey = "__thinkexUi";

interface AIThreadToolUiMetadata {
	documentEditReceiptId?: string;
}

export function attachDocumentEditReceiptMetadata(output: unknown, receiptId: string) {
	if (!isPlainRecord(output)) {
		return output;
	}

	return {
		...output,
		[aiThreadToolUiMetadataKey]: {
			documentEditReceiptId: receiptId,
		} satisfies AIThreadToolUiMetadata,
	};
}

export function getDocumentEditReceiptMetadata(output: unknown) {
	if (!isPlainRecord(output)) {
		return undefined;
	}

	const metadata = output[aiThreadToolUiMetadataKey];
	if (!isPlainRecord(metadata)) {
		return undefined;
	}

	return typeof metadata.documentEditReceiptId === "string"
		? metadata.documentEditReceiptId
		: undefined;
}

export function stripAIThreadToolUiMetadata(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(stripAIThreadToolUiMetadata);
	}
	if (!isPlainRecord(value)) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value).flatMap(([key, entry]) =>
			key === aiThreadToolUiMetadataKey ? [] : [[key, stripAIThreadToolUiMetadata(entry)]],
		),
	);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
