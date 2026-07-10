import { afterEach, describe, expect, it } from "bun:test";

import { createD1TestHarness } from "./d1-test-harness";

const disposers: Array<() => Promise<void>> = [];

afterEach(async () => {
	await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});

async function getDatabase() {
	const harness = await createD1TestHarness();
	disposers.push(harness.dispose);
	return harness.database;
}

async function seedUserAndProject(database: D1Database) {
	await database
		.prepare(
			"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.bind(
			"user-1",
			"User One",
			"one@example.test",
			1,
			1_700_000_000_000,
			1_700_000_000_000,
		)
		.run();
	await database
		.prepare(
			"INSERT INTO project (id, title, html_content, purchase_count, is_published, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(
			"project-1",
			"Project One",
			"<main>one</main>",
			5,
			1,
			"user-1",
			1_700_000_000_000,
			1_700_000_000_000,
		)
		.run();
}

describe("D1 schema", () => {
	it("creates the Better Auth and application tables", async () => {
		const database = await getDatabase();
		const result = await database
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
			)
			.all<{ name: string }>();

		expect(result.results.map(({ name }) => name)).toEqual([
			"account",
			"favorite",
			"generation_task",
			"project",
			"purchase",
			"session",
			"user",
			"verification",
		]);
	});

	it("enforces foreign keys, cascade, and one user relation per project", async () => {
		const database = await getDatabase();
		await seedUserAndProject(database);

		await expect(
			database
				.prepare(
					"INSERT INTO favorite (id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)",
				)
				.bind("favorite-invalid", "missing", "user-1", 1_700_000_000_000)
				.run(),
		).rejects.toThrow();

		await database
			.prepare(
				"INSERT INTO purchase (id, project_id, user_id, amount, created_at) VALUES (?, ?, ?, ?, ?)",
			)
			.bind("purchase-1", "project-1", "user-1", 0, 1_700_000_000_000)
			.run();
		await expect(
			database
				.prepare(
					"INSERT INTO purchase (id, project_id, user_id, amount, created_at) VALUES (?, ?, ?, ?, ?)",
				)
				.bind("purchase-2", "project-1", "user-1", 0, 1_700_000_000_001)
				.run(),
		).rejects.toThrow();

		await database
			.prepare("DELETE FROM user WHERE id = ?")
			.bind("user-1")
			.run();
		const project = await database
			.prepare("SELECT id FROM project WHERE id = ?")
			.bind("project-1")
			.first();
		const purchase = await database
			.prepare("SELECT id FROM purchase WHERE id = ?")
			.bind("purchase-1")
			.first();

		expect(project).toBeNull();
		expect(purchase).toBeNull();
	});

	it("stores booleans and timestamps deterministically", async () => {
		const database = await getDatabase();
		await seedUserAndProject(database);
		const row = await database
			.prepare(
				"SELECT is_published, created_at, purchase_count FROM project WHERE id = ?",
			)
			.bind("project-1")
			.first<{
				is_published: number;
				created_at: number;
				purchase_count: number;
			}>();

		expect(row).toEqual({
			is_published: 1,
			created_at: 1_700_000_000_000,
			purchase_count: 5,
		});
	});

	it("rejects generation task states with inconsistent terminal data", async () => {
		const database = await getDatabase();
		await database
			.prepare(
				"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind("user-1", "User One", "one@example.test", 1, 1, 1)
			.run();

		await expect(
			database
				.prepare(
					"INSERT INTO generation_task (id, user_id, status, model, encrypted_payload, result, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"task-1",
					"user-1",
					"COMPLETED",
					"model",
					"ciphertext",
					null,
					1,
					1,
					2,
				)
				.run(),
		).rejects.toThrow();

		await expect(
			database
				.prepare(
					"INSERT INTO generation_task (id, user_id, status, model, encrypted_payload, result, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"task-2",
					"user-1",
					"COMPLETED",
					"model",
					"ciphertext",
					"<main />",
					1,
					1,
					2,
				)
				.run(),
		).resolves.toBeDefined();
	});
});
