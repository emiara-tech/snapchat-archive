import { afterEach, describe, expect, it, vi } from "vitest";
import { composeImageLayers, unsupportedRecordedOverlay, validateCompositionRecipe, type ImageCompositionRecipe } from "../src/lib/imageComposition";

afterEach(() => vi.unstubAllGlobals());

function recipe(): ImageCompositionRecipe {
	return { version: 1, renderer: "browser-canvas-2d-v1", basis: "same-canvas-archive-layer", orientation: "decoded-source-orientation", canvas: { width: 8, height: 8 }, layer: { width: 8, height: 8 }, transform: { x: 0, y: 0, width: 8, height: 8, rotation: 0, opacity: 1 } };
}

describe("image composition evidence bounds", () => {
	it("rejects excessive compressed source bytes before copying or decoding them", async () => {
		const decode = vi.fn();
		vi.stubGlobal("createImageBitmap", decode);
		const original = new Blob([new Uint8Array(16 * 1024 * 1024 + 1)], { type: "image/png" });
		const read = vi.spyOn(original, "arrayBuffer");
		await expect(composeImageLayers(original, new Blob())).rejects.toThrow(/source byte budget/i);
		expect(read).not.toHaveBeenCalled();
		expect(decode).not.toHaveBeenCalled();
	});
	it("withholds guessed placement for nested recorded overlay evidence without rejecting unrelated fields", () => {
		expect(unsupportedRecordedOverlay({ Overlay: { rotation: 90 } })).toBe(true);
		expect(unsupportedRecordedOverlay({ Metadata: { Layers: [{ Transform: { scale: 2 } }] } })).toBe(true);
		expect(unsupportedRecordedOverlay({ Rotation: 90, Metadata: { position: "general source metadata" } })).toBe(false);
		expect(unsupportedRecordedOverlay({ Overlay: { Caption: "Recorded words", filename: "caption.png" } })).toBe(false);
	});
	it("does not guess placement for a differently sized overlay", () => {
		const mismatched = recipe(); mismatched.layer.width = 4;
		expect(() => validateCompositionRecipe(mismatched)).toThrow("same-canvas");
		mismatched.basis = "recorded-transform"; mismatched.transform = { x: 2, y: 2, width: 4, height: 4, rotation: 90, opacity: .5 };
		expect(() => validateCompositionRecipe(mismatched)).not.toThrow();
	});
	it("rejects oversized and nonfinite recorded transforms before drawing", () => {
		expect(() => validateCompositionRecipe(recipe(), 10)).toThrow("bounded composition");
		const invalid = recipe(); invalid.transform.rotation = Infinity;
		expect(() => validateCompositionRecipe(invalid)).toThrow("invalid");
	});
});
