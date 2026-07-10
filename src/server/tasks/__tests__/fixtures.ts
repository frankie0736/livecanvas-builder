import { createD1TestHarness } from "@/server/db/__tests__/d1-test-harness";

export const testPayloadKey = btoa(
	String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index + 1)),
);

export async function createTaskTestHarness() {
	const harness = await createD1TestHarness();
	const now = Date.now();
	await harness.database
		.prepare(
			"INSERT INTO user (id, name, email, email_verified, background_info, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(
			"user-1",
			"User",
			"user@example.test",
			1,
			"Business context",
			now,
			now,
		)
		.run();
	return harness;
}
