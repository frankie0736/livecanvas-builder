import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import handler from "@tanstack/react-start/server-entry";

export class ChatGenerationWorkflow extends WorkflowEntrypoint {
	async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
		return step.do("foundation-ready", async () => ({ ready: true }));
	}
}

export default {
	fetch: handler.fetch,
};
