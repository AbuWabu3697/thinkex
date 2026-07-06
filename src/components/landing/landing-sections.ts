export const FEATURES_SECTION_ID = "features";
export const PRICING_SECTION_ID = "pricing";

export type LandingSectionId = typeof FEATURES_SECTION_ID | typeof PRICING_SECTION_ID;

export const landingSectionScrollOptions = {
	block: "start",
	inline: "nearest",
	behavior: "auto",
} satisfies ScrollIntoViewOptions;

export function getLandingSectionId(hash: string) {
	const sectionId = hash.startsWith("#") ? hash.slice(1) : hash;

	switch (sectionId) {
		case FEATURES_SECTION_ID:
		case PRICING_SECTION_ID:
			return sectionId;
		default:
			return null;
	}
}

export function scrollLandingSectionIntoView(sectionId: LandingSectionId) {
	document.getElementById(sectionId)?.scrollIntoView(landingSectionScrollOptions);
}
