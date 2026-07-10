import { createFileRoute } from "@tanstack/react-router";
import { migrationApiPlaceholder } from "./-api-placeholder";
export const Route = createFileRoute("/api/metadata")({
	server: { handlers: { POST: migrationApiPlaceholder } },
});
