import { createFileRoute } from "@tanstack/react-router";

import { createCancelHandler } from "@/server/tasks/http";

export const Route = createFileRoute("/api/task/cancel")({
	server: { handlers: { POST: createCancelHandler() } },
});
