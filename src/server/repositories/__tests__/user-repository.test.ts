import { afterEach, describe, expect, it } from "bun:test";

import { createD1TestHarness } from "../../db/__tests__/d1-test-harness";
import { createUserRepository } from "../user-repository";

const disposers: Array<() => Promise<void>> = [];

afterEach(async () => {
	await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});

describe("user repository", () => {
	it("maps and updates profile fields by the authenticated user id", async () => {
		const harness = await createD1TestHarness();
		disposers.push(harness.dispose);
		await harness.database
			.prepare(
				"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
			)
			.bind(
				"user-1",
				"Before",
				"user@example.test",
				1_700_000_000_000,
				1_700_000_000_000,
			)
			.run();
		const repository = createUserRepository(harness.database);

		expect((await repository.get("user-1"))?.name).toBe("Before");
		const updated = await repository.update("user-1", {
			name: "After",
			image: "/api/media/avatar.jpg",
			backgroundInfo: "Context",
		});
		expect(updated).toMatchObject({
			name: "After",
			image: "/api/media/avatar.jpg",
			backgroundInfo: "Context",
		});
		expect(await repository.update("missing", { name: "No row" })).toBeNull();
	});
});
