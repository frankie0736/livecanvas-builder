import { createFileRoute } from "@tanstack/react-router";
import { migrationApiPlaceholder } from "./-api-placeholder";
export const Route = createFileRoute("/api/models/aihubmix")({
	server: { handlers: { GET: migrationApiPlaceholder } },
});
