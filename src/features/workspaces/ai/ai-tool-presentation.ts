export type AiToolVisibility = "hidden" | "visible";
export type AiToolActivityIconKind = "code" | "edit" | "file" | "search" | "web";

interface AiToolPresentation {
	visibility: AiToolVisibility;
}

const defaultToolPresentation = {
	visibility: "visible",
} as const satisfies AiToolPresentation;

const hiddenToolNames = new Set(["sandbox_bash", "workspace_link_items"]);

export function getAiToolPresentation(toolName: string): AiToolPresentation {
	if (toolName.startsWith("time_") || hiddenToolNames.has(toolName)) {
		return { visibility: "hidden" };
	}

	return defaultToolPresentation;
}

export function getAiToolActivityIconKind(toolName: string): AiToolActivityIconKind {
	if (toolName === "compute" || toolName === "orchestrate") {
		return "code";
	}

	if (toolName.startsWith("web_") || toolName.startsWith("research_")) {
		return toolName.includes("search") || toolName.includes("discover") ? "search" : "web";
	}

	if (toolName.startsWith("workspace_")) {
		return toolName.includes("read") || toolName.includes("list") ? "file" : "edit";
	}

	return "web";
}
