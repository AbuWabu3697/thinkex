import { fromBuffer } from "@capsizecss/unpack";
import { createFontStack } from "@capsizecss/core";
import arial from "@capsizecss/metrics/arial";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const woff2 = resolve(
	here,
	"../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
);

const geist = await fromBuffer(await readFile(woff2));

const { fontFaces } = createFontStack([
	{
		familyName: "Geist Variable",
		category: geist.category,
		capHeight: geist.capHeight,
		ascent: geist.ascent,
		descent: geist.descent,
		lineGap: geist.lineGap,
		unitsPerEm: geist.unitsPerEm,
		xHeight: geist.xHeight,
		xWidthAvg: geist.xWidthAvg,
	},
	arial,
]);

console.log("--- Geist metrics ---");
console.log(
	JSON.stringify(
		{
			ascent: geist.ascent,
			descent: geist.descent,
			lineGap: geist.lineGap,
			unitsPerEm: geist.unitsPerEm,
			xWidthAvg: geist.xWidthAvg,
		},
		null,
		2,
	),
);
console.log("--- fallback @font-face ---");
console.log(fontFaces);
