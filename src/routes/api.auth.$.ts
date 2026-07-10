import { createFileRoute } from "@tanstack/react-router";
import { migrationApiPlaceholder } from "./-api-placeholder";
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: { GET: migrationApiPlaceholder, POST: migrationApiPlaceholder },
	},
});
