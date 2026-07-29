export type WorkspaceFileConversionFailure = "conversion_failed" | "output_too_large";

export class WorkspaceFileConversionError extends Error {
	readonly userMessage: string;

	constructor(
		message: string,
		userMessage: string,
		readonly failure: WorkspaceFileConversionFailure = "conversion_failed",
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = "WorkspaceFileConversionError";
		this.userMessage = userMessage;
	}
}
