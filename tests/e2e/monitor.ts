import type { Page } from "@playwright/test";

export function monitorPage(page: Page) {
	const errors: string[] = [];
	page.on("console", (message) => {
		if (
			message.type() === "error" &&
			!message.text().startsWith("Failed to load resource:")
		) {
			errors.push(message.text());
		}
	});
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("requestfailed", (request) => {
		const errorText = request.failure()?.errorText ?? "unknown";
		if (
			!errorText.includes("ERR_ABORTED") &&
			new URL(request.url()).origin === new URL(page.url()).origin
		) {
			errors.push(`${request.method()} ${request.url()} failed: ${errorText}`);
		}
	});
	return errors;
}
