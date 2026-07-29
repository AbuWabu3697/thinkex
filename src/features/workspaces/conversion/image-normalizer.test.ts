import { describe, expect, it, vi } from "vitest";

import type { WorkspaceFileConversionError } from "#/features/workspaces/conversion/errors";
import {
	normalizeChatImageToJpeg,
	normalizeImageToJpeg,
} from "#/features/workspaces/conversion/image-normalizer";

describe("image normalizer", () => {
	const maxBytes = 1024 * 1024;

	it("streams canonical JPEG output from the Images binding", async () => {
		const output = new Uint8Array([9, 8, 7]);
		const images = createImagesBinding([output]);
		const result = await normalizeImageToJpeg(
			createEnv(images.binding),
			stream(new Uint8Array([1, 2, 3])),
			maxBytes,
		);

		expect(new Uint8Array(await new Response(result.body).arrayBuffer())).toEqual(output);
		expect(result.sizeBytes).toBe(output.byteLength);
		expect(images.input).toHaveBeenCalledTimes(1);
		expect(images.image).toHaveBeenCalledTimes(1);
		expect(images.output).toHaveBeenCalledWith({
			anim: false,
			background: "#ffffff",
			format: "image/jpeg",
			quality: 92,
		});
	});

	it("uses one bounded profile for chat images", async () => {
		const accepted = new Uint8Array([1, 2, 3, 4]);
		const images = createImagesBinding([accepted]);

		const result = await normalizeChatImageToJpeg(
			createEnv(images.binding),
			stream(new Uint8Array([1, 2, 3])),
			maxBytes,
		);

		expect(new Uint8Array(result.bytes)).toEqual(accepted);
		expect(images.input).toHaveBeenCalledTimes(1);
		expect(images.transform).toHaveBeenCalledWith({
			fit: "scale-down",
			height: 1024,
			width: 1024,
		});
		expect(images.output).toHaveBeenCalledWith({
			anim: false,
			background: "#ffffff",
			format: "image/jpeg",
			quality: 70,
		});
	});

	it("translates Images failures at the Module boundary", async () => {
		const cause = new Error("binding unavailable");
		const images = createImagesBinding([cause]);

		await expect(
			normalizeChatImageToJpeg(
				createEnv(images.binding),
				stream(new Uint8Array([1, 2, 3])),
				maxBytes,
			),
		).rejects.toMatchObject({
			cause,
			message: "binding unavailable",
			name: "ImageNormalizationError",
			userMessage: "Unable to convert this image right now.",
		} satisfies Partial<WorkspaceFileConversionError>);
	});

	it("rejects chat images that exceed the normalized output limit", async () => {
		const oversized = new Uint8Array(1024 * 1024 + 1);
		const images = createImagesBinding([oversized]);

		await expect(
			normalizeChatImageToJpeg(
				createEnv(images.binding),
				stream(new Uint8Array([1, 2, 3])),
				maxBytes,
			),
		).rejects.toMatchObject({
			failure: "output_too_large",
			name: "ImageNormalizationError",
		} satisfies Partial<WorkspaceFileConversionError>);
		expect(images.output).toHaveBeenCalledTimes(1);
	});

	it("bounds canonical workspace JPEG output", async () => {
		const images = createImagesBinding([new Uint8Array(maxBytes + 1)]);

		await expect(
			normalizeImageToJpeg(createEnv(images.binding), stream(new Uint8Array([1, 2, 3])), maxBytes),
		).rejects.toMatchObject({
			failure: "output_too_large",
			name: "ImageNormalizationError",
		});
	});

	it.each(["workspace", "chat"] as const)("rejects empty %s image output", async (kind) => {
		const images = createImagesBinding([new Uint8Array()]);

		const result =
			kind === "workspace"
				? normalizeImageToJpeg(
						createEnv(images.binding),
						stream(new Uint8Array([1, 2, 3])),
						maxBytes,
					)
				: normalizeChatImageToJpeg(
						createEnv(images.binding),
						stream(new Uint8Array([1, 2, 3])),
						maxBytes,
					);

		await expect(result).rejects.toMatchObject({
			message: "Image conversion returned an empty JPEG.",
			name: "ImageNormalizationError",
		});
		expect(images.image).toHaveBeenCalledTimes(1);
	});
});

function createImagesBinding(outputs: Array<Uint8Array | Error>) {
	let outputIndex = 0;
	const image = vi.fn((value: Uint8Array) => stream(value));
	const output = vi.fn(async () => {
		const value = outputs[outputIndex++];

		if (!value) {
			throw new Error("Missing fake Images output.");
		}
		if (value instanceof Error) {
			throw value;
		}

		return {
			contentType: () => "image/jpeg",
			image: () => image(value),
			response: () =>
				new Response(value.slice().buffer, {
					headers: {
						"content-type": "image/jpeg",
					},
				}),
		} satisfies ImageTransformationResult;
	});
	const transform = vi.fn(() => ({ output }));
	const input = vi.fn(() => ({ output, transform }));

	return {
		binding: { input } as unknown as ImagesBinding,
		image,
		input,
		output,
		transform,
	};
}

function createEnv(images: ImagesBinding) {
	return { IMAGES: images } as Cloudflare.Env;
}

function stream(bytes: Uint8Array) {
	const body = new Response(bytes.slice().buffer).body;

	if (!body) {
		throw new Error("Test stream was not created.");
	}

	return body;
}
