import { createFileRoute } from "@tanstack/react-router";

import { createStatusHandler } from "@/server/tasks/http";

export const Route = createFileRoute("/api/task/status")({
	server: { handlers: { GET: createStatusHandler() } },
});
