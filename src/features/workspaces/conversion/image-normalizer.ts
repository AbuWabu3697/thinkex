import { WorkspaceFileConversionError } from "#/features/workspaces/conversion/errors";
import type { SizedResponseBody } from "#/lib/http/sized-response-body";
import { requireSizedResponseBody } from "#/lib/http/sized-response-body";

const jpegContentType = "image/jpeg";
const chatProfiles = [
	{ dimension: 2048, quality: 85 },
	{ dimension: 1024, quality: 70 },
] as const;

export type OpenImageBody = () => Promise<ReadableStream<Uint8Array>>;

export interface NormalizedChatImage {
	bytes: ArrayBuffer;
	contentType: typeof jpegContentType;
	sizeBytes: number;
}

export class ImageNormalizationError extends WorkspaceFileConversionError {
	constructor(message: string) {
		super(message, "Unable to convert this image right now.");
		this.name = "ImageNormalizationError";
	}
}

export async function normalizeImageToJpeg(
	env: Cloudflare.Env,
	body: ReadableStream<Uint8Array>,
): Promise<SizedResponseBody> {
	return translateImageNormalizationErrors(async () => {
		const result = await env.IMAGES.input(body).output({
			anim: false,
			background: "#ffffff",
			format: jpegContentType,
			quality: 92,
		});

		return requireSizedResponseBody(result.response(), createEmptyImageError);
	});
}

export async function normalizeChatImageToJpeg(
	env: Cloudflare.Env,
	openBody: OpenImageBody,
	maxBytes: number,
): Promise<NormalizedChatImage> {
	return translateImageNormalizationErrors(async () => {
		for (const profile of chatProfiles) {
			const result = await env.IMAGES.input(await openBody())
				.transform({
					fit: "scale-down",
					height: profile.dimension,
					width: profile.dimension,
				})
				.output({
					anim: false,
					background: "#ffffff",
					format: jpegContentType,
					quality: profile.quality,
				});
			const bytes = await readBodyWithinLimit(result.response(), maxBytes);

			if (bytes) {
				return {
					bytes,
					contentType: jpegContentType,
					sizeBytes: bytes.byteLength,
				};
			}
		}

		throw new ImageNormalizationError(
			"Cloudflare Images could not produce a JPEG within the chat attachment limit.",
		);
	});
}

async function readBodyWithinLimit(
	response: Response,
	maxBytes: number,
): Promise<ArrayBuffer | null> {
	if (!response.body) {
		throw createEmptyImageError();
	}

	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
		await response.body.cancel("Image output exceeds the byte limit.");
		return null;
	}

	return readStreamWithinLimit(response.body, maxBytes);
}

async function readStreamWithinLimit(
	body: ReadableStream<Uint8Array>,
	maxBytes: number,
): Promise<ArrayBuffer | null> {
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (totalBytes + value.byteLength > maxBytes) {
				await reader.cancel("Image output exceeds the byte limit.");
				return null;
			}

			chunks.push(value);
			totalBytes += value.byteLength;
		}
	} finally {
		reader.releaseLock();
	}

	if (totalBytes === 0) {
		throw createEmptyImageError();
	}

	const bytes = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return bytes.buffer;
}

function createEmptyImageError() {
	return new ImageNormalizationError("Image conversion returned an empty JPEG.");
}

async function translateImageNormalizationErrors<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof ImageNormalizationError) {
			throw error;
		}

		throw new ImageNormalizationError(
			error instanceof Error ? error.message : "Image normalization failed.",
		);
	}
}
