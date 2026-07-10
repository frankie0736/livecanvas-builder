import { createFileRoute } from "@tanstack/react-router";
import { migrationApiPlaceholder } from "./-api-placeholder";
export const Route = createFileRoute("/api/task/cancel")({
	server: { handlers: { POST: migrationApiPlaceholder } },
});
