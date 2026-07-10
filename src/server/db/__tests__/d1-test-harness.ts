import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Miniflare } from "miniflare";

export async function createD1TestHarness() {
	const miniflare = new Miniflare({
		compatibilityDate: "2026-07-10",
		d1Databases: ["DB"],
		modules: true,
		script: "export default { fetch() { return new Response('ok') } }",
	});
	const database = await miniflare.getD1Database("DB");
	const migrationDirectory = join(process.cwd(), "migrations");
	const migrationFiles = (await readdir(migrationDirectory))
		.filter((file) => file.endsWith(".sql"))
		.sort();

	if (migrationFiles.length === 0) {
		throw new Error("No D1 migrations found");
	}

	for (const migrationFile of migrationFiles) {
		const migration = await readFile(
			join(migrationDirectory, migrationFile),
			"utf8",
		);
		const statements = migration
			.split("--> statement-breakpoint")
			.map((statement) => statement.trim())
			.filter(Boolean);

		for (const statement of statements) {
			await database.prepare(statement).run();
		}
	}

	return {
		database,
		dispose: () => miniflare.dispose(),
	};
}
