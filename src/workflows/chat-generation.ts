import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";

import {
	type GenerationWorkflowEnv,
	type GenerationWorkflowParams,
	executeGenerationTask,
} from "./generation-runner";

export class ChatGenerationWorkflow extends WorkflowEntrypoint<
	GenerationWorkflowEnv,
	GenerationWorkflowParams
> {
	run(
		event: Readonly<WorkflowEvent<GenerationWorkflowParams>>,
		step: WorkflowStep,
	) {
		return executeGenerationTask(event.payload, this.env, step);
	}
}
