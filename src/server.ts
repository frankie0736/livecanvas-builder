import handler from "@tanstack/react-start/server-entry";

export { ChatGenerationWorkflow } from "./workflows/chat-generation";

export default {
	fetch: handler.fetch,
};
