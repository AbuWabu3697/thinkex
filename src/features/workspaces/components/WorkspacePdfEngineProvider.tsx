import { PdfEngineProvider, usePdfiumEngine } from "@embedpdf/engines/react";
import { type ReactNode, useEffect, useState } from "react";

import pdfiumWasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { buildClientAbsoluteUrl } from "#/lib/client-url";

const INACTIVE_ENGINE_STATE: ReturnType<typeof usePdfiumEngine> = {
	engine: null,
	error: null,
	isLoading: true,
};

export function WorkspacePdfEngineProvider({
	active,
	children,
}: {
	active: boolean;
	children: ReactNode;
}) {
	const [engineState, setEngineState] = useState(INACTIVE_ENGINE_STATE);
	const visibleEngineState = active ? engineState : INACTIVE_ENGINE_STATE;

	return (
		<PdfEngineProvider {...visibleEngineState}>
			{children}
			{/* The third-party hook has no enabled option; isolate it so this provider stays mounted. */}
			{active ? <WorkspacePdfEngineLoader onStateChange={setEngineState} /> : null}
		</PdfEngineProvider>
	);
}

function WorkspacePdfEngineLoader({
	onStateChange,
}: {
	onStateChange: (state: ReturnType<typeof usePdfiumEngine>) => void;
}) {
	const wasmUrl =
		typeof window === "undefined" ? pdfiumWasmUrl : buildClientAbsoluteUrl(pdfiumWasmUrl);
	const { engine, error, isLoading } = usePdfiumEngine({
		fontFallback: null,
		wasmUrl,
	});

	useEffect(() => {
		onStateChange({ engine, error, isLoading });
	}, [engine, error, isLoading, onStateChange]);
	useEffect(
		() => () => {
			onStateChange(INACTIVE_ENGINE_STATE);
		},
		[onStateChange],
	);

	return null;
}
