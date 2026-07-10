import { afterEach, describe, expect, it } from "bun:test";
import { serializeSignedCookie } from "better-call";

import { createD1TestHarness } from "../../db/__tests__/d1-test-harness";
import { createAuth } from "../config";

const secret = "test-secret-that-is-at-least-32-characters-long";
const disposers: Array<() => Promise<void>> = [];

afterEach(async () => {
	await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});

async function createFixture() {
	const harness = await createD1TestHarness();
	disposers.push(harness.dispose);
	const auth = createAuth({
		AUTH_SECRET: secret,
		AUTH_GOOGLE_ID: "google-client-id",
		AUTH_GOOGLE_SECRET: "google-client-secret",
		AUTH_DISCORD_ID: "discord-client-id",
		AUTH_DISCORD_SECRET: "discord-client-secret",
		AUTH_BASE_URL: "http://localhost:3000",
		DB: harness.database,
	});
	return { auth, database: harness.database };
}

describe("Better Auth D1 boundary", () => {
	it("configures only the existing Google and Discord providers", async () => {
		const { auth } = await createFixture();

		expect(Object.keys(auth.options.socialProviders ?? {}).sort()).toEqual([
			"discord",
			"google",
		]);
	});

	it("returns no session without a signed cookie", async () => {
		const { auth } = await createFixture();

		expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
		const response = await auth.handler(
			new Request("http://localhost:3000/api/auth/get-session"),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toBeNull();
	});

	it("loads the signed session and additional user fields from D1", async () => {
		const { auth, database } = await createFixture();
		const now = Date.now();
		await database
			.prepare(
				"INSERT INTO user (id, name, email, email_verified, background_info, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				"user-1",
				"User One",
				"one@example.test",
				1,
				"Company context",
				now,
				now,
			)
			.run();
		await database
			.prepare(
				"INSERT INTO session (id, expires_at, token, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind("session-1", now + 60_000, "session-token", "user-1", now, now)
			.run();
		const signedCookie = await serializeSignedCookie(
			"better-auth.session_token",
			"session-token",
			secret,
		);
		const headers = new Headers({
			cookie: signedCookie.split(";", 1)[0] ?? "",
		});

		const session = await auth.api.getSession({ headers });

		expect(session?.user).toMatchObject({
			id: "user-1",
			email: "one@example.test",
			backgroundInfo: "Company context",
		});
	});
});
