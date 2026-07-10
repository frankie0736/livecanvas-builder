import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { resolveNeonSnapshotUrl } from "../source-url";
import { createImportSql } from "../sql";
import { transformSnapshot } from "../transform";

const source = {
	user: [
		{
			id: "user-1",
			name: "Test User",
			email: "user@example.test",
			emailVerified: "2025-01-02T03:04:05.000Z",
			image: null,
			backgroundInfo: "Quoted ' text",
			createdAt: "2025-01-01T00:00:00.000Z",
			updatedAt: "2025-01-02T00:00:00.000Z",
		},
	],
	account: [
		{
			id: "account-1",
			userId: "user-1",
			provider: "google",
			providerAccountId: "provider-1",
			refresh_token: null,
			access_token: "token-value",
			expires_at: 1_735_776_000,
			scope: "openid email",
			id_token: null,
			createdAt: "2025-01-01T00:00:00.000Z",
			updatedAt: "2025-01-02T00:00:00.000Z",
		},
	],
	session: [{ sessionToken: "must-not-import" }],
	project: [
		{
			id: "project-1",
			title: "O'Reilly",
			description: null,
			htmlContent: '<main data-label="quoted">line 1\nline 2</main>',
			thumbnail: null,
			tags: null,
			purchaseCount: 7,
			isPublished: true,
			userId: "user-1",
			createdAt: "2025-01-01T00:00:00.000Z",
			updatedAt: "2025-01-02T00:00:00.000Z",
		},
	],
	purchase: [],
	favorite: [],
};

describe("snapshot source URL", () => {
	it("uses the direct Neon endpoint for snapshot reads", () => {
		const resolved = new URL(
			resolveNeonSnapshotUrl(
				"postgresql://ep-source-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require",
			),
		);

		expect(resolved.hostname).toBe("ep-source.ap-southeast-1.aws.neon.tech");
		expect(resolved.searchParams.get("channel_binding")).toBe("disable");
		expect(resolved.searchParams.get("sslmode")).toBe("require");
	});
});

describe("PostgreSQL to D1 transformation", () => {
	it("maps auth, time, boolean, null, and preserved counters deterministically", () => {
		const target = transformSnapshot(source);

		expect(target.user[0]).toMatchObject({
			id: "user-1",
			email_verified: 1,
			background_info: "Quoted ' text",
			created_at: 1_735_689_600_000,
		});
		expect(target.account[0]).toMatchObject({
			account_id: "provider-1",
			provider_id: "google",
			access_token_expires_at: 1_735_776_000_000,
		});
		expect(target.project[0]).toMatchObject({
			purchase_count: 7,
			is_published: 1,
			tags: "",
		});
		expect("session" in target).toBe(false);
	});

	it("imports special text through valid SQLite literals", () => {
		const target = transformSnapshot(source);
		const database = new Database(":memory:");
		const migration = readFileSync(
			"migrations/0000_initial.sql",
			"utf8",
		).replaceAll("--> statement-breakpoint", "");
		database.exec(migration);
		database.exec(createImportSql(target));

		expect(
			database
				.query("SELECT title, html_content, purchase_count FROM project")
				.get(),
		).toEqual({
			title: "O'Reilly",
			html_content: '<main data-label="quoted">line 1\nline 2</main>',
			purchase_count: 7,
		});
		expect(
			database.query("SELECT count(*) AS count FROM session").get(),
		).toEqual({
			count: 0,
		});
		database.close();
	});
});
