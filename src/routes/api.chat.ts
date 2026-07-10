import { createFileRoute } from "@tanstack/react-router";
import { migrationApiPlaceholder } from "./-api-placeholder";
export const Route = createFileRoute("/api/chat")({
	server: { handlers: { POST: migrationApiPlaceholder } },
});
