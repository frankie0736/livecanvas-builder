import { createFileRoute } from "@tanstack/react-router";

import { createSubmitHandler } from "@/server/tasks/http";

export const Route = createFileRoute("/api/task/submit")({
	server: { handlers: { POST: createSubmitHandler() } },
});
