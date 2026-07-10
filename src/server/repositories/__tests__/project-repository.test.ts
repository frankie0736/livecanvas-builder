import { afterEach, describe, expect, it } from "bun:test";

import { createD1TestHarness } from "../../db/__tests__/d1-test-harness";
import { createProjectRepository } from "../project-repository";

const disposers: Array<() => Promise<void>> = [];

afterEach(async () => {
	await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});

async function createFixture() {
	const harness = await createD1TestHarness();
	disposers.push(harness.dispose);
	const { database } = harness;
	const timestamp = 1_700_000_000_000;

	await database.batch([
		database
			.prepare(
				"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind("user-1", "User One", "one@example.test", 1, timestamp, timestamp),
		database
			.prepare(
				"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind("user-2", "User Two", "two@example.test", 1, timestamp, timestamp),
	]);
	await database.batch([
		database
			.prepare(
				"INSERT INTO project (id, title, html_content, tags, purchase_count, is_published, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				"project-1",
				"Published One",
				"<main>one</main>",
				"landing,b2b",
				0,
				1,
				"user-1",
				timestamp + 2,
				timestamp + 2,
			),
		database
			.prepare(
				"INSERT INTO project (id, title, html_content, tags, purchase_count, is_published, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				"project-2",
				"Private One",
				"<main>private</main>",
				"internal",
				0,
				0,
				"user-1",
				timestamp + 1,
				timestamp + 1,
			),
		database
			.prepare(
				"INSERT INTO project (id, title, html_content, tags, purchase_count, is_published, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				"project-3",
				"Published Two",
				"<main>two</main>",
				"landing",
				0,
				1,
				"user-2",
				timestamp + 3,
				timestamp + 3,
			),
	]);

	return {
		database,
		repository: createProjectRepository(database),
	};
}

describe("project repository", () => {
	it("keeps public, owned, and favorite query boundaries distinct", async () => {
		const { database, repository } = await createFixture();
		await database
			.prepare(
				"INSERT INTO favorite (id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)",
			)
			.bind("favorite-1", "project-3", "user-1", 1_700_000_000_010)
			.run();

		const published = await repository.listPublishedProjects({
			limit: 12,
			offset: 0,
			tags: ["landing", "b2b"],
		});
		const owned = await repository.listOwnedProjects("user-1");
		const favorites = await repository.listFavoriteProjects("user-1");

		expect(published.projects.map(({ id }) => id)).toEqual(["project-1"]);
		expect(published.totalCount).toBe(1);
		expect(owned.map(({ id }) => id)).toEqual(["project-1", "project-2"]);
		expect(favorites.map(({ id }) => id)).toEqual(["project-3"]);
		expect(await repository.getOwnedProject("user-2", "project-1")).toBeNull();
	});

	it("keeps purchase rows unique and count mutation atomic", async () => {
		const { database, repository } = await createFixture();

		await Promise.all(
			Array.from({ length: 10 }, () =>
				repository.togglePurchase("user-1", "project-3"),
			),
		);
		const purchased = await database
			.prepare(
				"SELECT (SELECT count(*) FROM purchase WHERE user_id = ? AND project_id = ?) AS rows, purchase_count AS count FROM project WHERE id = ?",
			)
			.bind("user-1", "project-3", "project-3")
			.first<{ rows: number; count: number }>();

		expect(purchased).not.toBeNull();
		if (!purchased) throw new Error("Seeded project was not found");
		expect(purchased.rows === 0 || purchased.rows === 1).toBe(true);
		expect(purchased.count).toBe(purchased.rows);
		expect(await repository.togglePurchase("user-1", "project-3")).toEqual({
			purchased: purchased.rows === 0,
		});
		const removed = await database
			.prepare(
				"SELECT (SELECT count(*) FROM purchase WHERE user_id = ? AND project_id = ?) AS rows, purchase_count AS count FROM project WHERE id = ?",
			)
			.bind("user-1", "project-3", "project-3")
			.first<{ rows: number; count: number }>();
		expect(removed).toEqual({
			rows: purchased.rows === 0 ? 1 : 0,
			count: purchased.rows === 0 ? 1 : 0,
		});
	});

	it("keeps favorite rows unique under repeated concurrent toggles", async () => {
		const { database, repository } = await createFixture();

		await Promise.all(
			Array.from({ length: 10 }, () =>
				repository.toggleFavorite("user-1", "project-3"),
			),
		);
		const count = await database
			.prepare(
				"SELECT count(*) AS count FROM favorite WHERE user_id = ? AND project_id = ?",
			)
			.bind("user-1", "project-3")
			.first<number>("count");

		expect(count === 0 || count === 1).toBe(true);
		expect(await repository.toggleFavorite("user-1", "project-3")).toEqual({
			favorited: count === 0,
		});
	});

	it("owns project writes and derives published tags from D1", async () => {
		const { repository } = await createFixture();
		const created = await repository.createProject("user-1", {
			id: "project-new",
			title: "New project",
			description: "Initial",
			htmlContent: "<main>new</main>",
			tags: "landing, launch",
			isPublished: true,
		});
		expect(created?.userId).toBe("user-1");
		expect(
			await repository.getOwnedProject("user-2", "project-new"),
		).toBeNull();

		const updated = await repository.updateOwnedProject(
			"user-1",
			"project-new",
			{ title: "Updated", isPublished: false },
		);
		expect(updated?.title).toBe("Updated");
		expect(updated?.isPublished).toBe(false);
		expect(await repository.listPublishedTags()).toEqual(["b2b", "landing"]);
		expect(
			await repository.deleteOwnedProject("user-2", "project-new"),
		).toBeNull();
		expect(
			await repository.deleteOwnedProject("user-1", "project-new"),
		).not.toBeNull();
		expect(
			await repository.getOwnedProject("user-1", "project-new"),
		).toBeNull();
	});
});
