import {
	WorkspaceFileConversionError,
	type WorkspaceFileConversionFailure,
} from "#/features/workspaces/conversion/errors";
import type { SizedResponseBody } from "#/lib/http/sized-response-body";

const jpegContentType = "image/jpeg";
const workspaceProfile = { quality: 92 } as const;
const chatProfile = { dimension: 1024, quality: 70 } as const;

type ImageProfile = {
	dimension?: number;
	quality: number;
};

interface NormalizedChatImage {
	bytes: ArrayBuffer;
	contentType: typeof jpegContentType;
	sizeBytes: number;
}

class ImageNormalizationError extends WorkspaceFileConversionError {
	constructor(
		message: string,
		failure: WorkspaceFileConversionFailure = "conversion_failed",
		options?: ErrorOptions,
	) {
		super(message, "Unable to convert this image right now.", failure, options);
		this.name = "ImageNormalizationError";
	}
}

export async function normalizeImageToJpeg(
	env: Cloudflare.Env,
	body: ReadableStream<Uint8Array>,
	maxBytes: number,
): Promise<SizedResponseBody> {
	return translateImageNormalizationErrors(async () => {
		const bytes = await normalizeWithProfile(env, body, workspaceProfile, maxBytes);

		if (!bytes) {
			throw createImageOutputTooLargeError(maxBytes);
		}

		return {
			body: new Blob([bytes], { type: jpegContentType }).stream(),
			sizeBytes: bytes.byteLength,
		};
	});
}

export async function normalizeChatImageToJpeg(
	env: Cloudflare.Env,
	body: ReadableStream<Uint8Array>,
	maxBytes: number,
): Promise<NormalizedChatImage> {
	return translateImageNormalizationErrors(async () => {
		const bytes = await normalizeWithProfile(env, body, chatProfile, maxBytes);

		if (bytes) {
			return {
				bytes,
				contentType: jpegContentType,
				sizeBytes: bytes.byteLength,
			};
		}

		throw createImageOutputTooLargeError(maxBytes);
	});
}

async function normalizeWithProfile(
	env: Cloudflare.Env,
	body: ReadableStream<Uint8Array>,
	profile: ImageProfile,
	maxBytes: number,
): Promise<ArrayBuffer | null> {
	let transformer = env.IMAGES.input(body);

	if (profile.dimension) {
		transformer = transformer.transform({
			fit: "scale-down",
			height: profile.dimension,
			width: profile.dimension,
		});
	}

	const result = await transformer.output({
		anim: false,
		background: "#ffffff",
		format: jpegContentType,
		quality: profile.quality,
	});

	return readStreamWithinLimit(result.image(), maxBytes);
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

function createImageOutputTooLargeError(maxBytes: number) {
	return new ImageNormalizationError(
		`Cloudflare Images output exceeds the ${maxBytes}-byte limit.`,
		"output_too_large",
	);
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
			"conversion_failed",
			{ cause: error },
		);
	}
}
