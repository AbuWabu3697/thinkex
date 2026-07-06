/** Scroll the main viewport to the top (smooth unless reduced motion is preferred). */
export function smoothScrollViewportTop() {
	if (typeof window === "undefined") {
		return;
	}

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const root =
		(document.querySelector("[data-scroll-root]") as HTMLElement | null) ??
		(document.scrollingElement as HTMLElement | null) ??
		document.documentElement;

	requestAnimationFrame(() => {
		root.scrollTo({ top: 0, left: 0, behavior: reduced ? "auto" : "smooth" });
	});
}
