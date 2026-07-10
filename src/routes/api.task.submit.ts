import { createFileRoute } from "@tanstack/react-router";
import { migrationApiPlaceholder } from "./-api-placeholder";
export const Route = createFileRoute("/api/task/submit")({
	server: { handlers: { POST: migrationApiPlaceholder } },
});
