import { describe, expect, it, vi } from "vitest";

import {
	ImageNormalizationError,
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
		);

		expect(new Uint8Array(await new Response(result.body).arrayBuffer())).toEqual(output);
		expect(result.sizeBytes).toBe(output.byteLength);
		expect(images.input).toHaveBeenCalledTimes(1);
		expect(images.output).toHaveBeenCalledWith({
			anim: false,
			background: "#ffffff",
			format: "image/jpeg",
			quality: 92,
		});
	});

	it("uses progressively smaller chat profiles until output fits one MiB", async () => {
		const oversized = new Uint8Array(1024 * 1024 + 1);
		const accepted = new Uint8Array([1, 2, 3, 4]);
		const images = createImagesBinding([oversized, accepted]);
		const openBody = createOpenBody();

		const result = await normalizeChatImageToJpeg(createEnv(images.binding), openBody, maxBytes);

		expect(new Uint8Array(result.bytes)).toEqual(accepted);
		expect(openBody).toHaveBeenCalledTimes(2);
		expect(images.transform).toHaveBeenNthCalledWith(1, {
			fit: "scale-down",
			height: 2048,
			width: 2048,
		});
		expect(images.transform).toHaveBeenNthCalledWith(2, {
			fit: "scale-down",
			height: 1024,
			width: 1024,
		});
		expect(images.output).toHaveBeenNthCalledWith(1, {
			anim: false,
			background: "#ffffff",
			format: "image/jpeg",
			quality: 85,
		});
		expect(images.output).toHaveBeenNthCalledWith(2, {
			anim: false,
			background: "#ffffff",
			format: "image/jpeg",
			quality: 70,
		});
	});

	it("translates Images failures at the Module boundary", async () => {
		const images = createImagesBinding([new Error("binding unavailable")]);

		await expect(
			normalizeChatImageToJpeg(createEnv(images.binding), createOpenBody(), maxBytes),
		).rejects.toMatchObject({
			message: "binding unavailable",
			name: "ImageNormalizationError",
			userMessage: "Unable to convert this image right now.",
		} satisfies Partial<ImageNormalizationError>);
	});

	it("rejects chat images that exceed the limit after both profiles", async () => {
		const oversized = new Uint8Array(1024 * 1024 + 1);
		const images = createImagesBinding([oversized, oversized]);
		const openBody = createOpenBody();

		await expect(
			normalizeChatImageToJpeg(createEnv(images.binding), openBody, maxBytes),
		).rejects.toBeInstanceOf(ImageNormalizationError);
		expect(openBody).toHaveBeenCalledTimes(2);
		expect(images.output).toHaveBeenCalledTimes(2);
	});
});

function createOpenBody() {
	return vi.fn(async () => stream(new Uint8Array([1, 2, 3])));
}

function createImagesBinding(outputs: Array<Uint8Array | Error>) {
	let outputIndex = 0;
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
			image: () => stream(value),
			response: () =>
				new Response(value.slice().buffer, {
					headers: {
						"content-length": String(value.byteLength),
						"content-type": "image/jpeg",
					},
				}),
		} satisfies ImageTransformationResult;
	});
	const transform = vi.fn(() => ({ output }));
	const input = vi.fn(() => ({ output, transform }));

	return {
		binding: { input } as unknown as ImagesBinding,
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
