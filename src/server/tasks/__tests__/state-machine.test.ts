import { describe, expect, it } from "bun:test";

import { canTransitionTask, isTerminalTaskStatus } from "../state-machine";

describe("generation task state machine", () => {
	it("expresses valid transitions without terminal escape paths", () => {
		expect(canTransitionTask("PENDING", "RUNNING")).toBe(true);
		expect(canTransitionTask("PENDING", "CANCELED")).toBe(true);
		expect(canTransitionTask("RUNNING", "COMPLETED")).toBe(true);
		expect(canTransitionTask("COMPLETED", "CANCELED")).toBe(false);
		expect(canTransitionTask("CANCELED", "COMPLETED")).toBe(false);
		expect(isTerminalTaskStatus("FAILED")).toBe(true);
	});
});
