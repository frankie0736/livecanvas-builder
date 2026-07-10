import { createFileRoute } from "@tanstack/react-router";
import { migrationApiPlaceholder } from "./-api-placeholder";
export const Route = createFileRoute("/api/task/status")({
	server: { handlers: { GET: migrationApiPlaceholder } },
});
