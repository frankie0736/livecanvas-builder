import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { serializeSignedCookie } from "better-call";
import { config } from "dotenv";
import { authStatePath } from "../../playwright.config";

export default async function globalSetup() {
	const env = config({ path: resolve(".dev.vars") }).parsed ?? {};
	const secret = env.AUTH_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error("AUTH_SECRET is missing from .dev.vars");
	}
	const now = Date.now();
	const expiresAt = now + 24 * 60 * 60 * 1000;
	const sql = [
		"DELETE FROM user WHERE id = 'e2e-user'",
		`INSERT INTO user (id, name, email, email_verified, background_info, created_at, updated_at) VALUES ('e2e-user', 'Local Test User', 'local-e2e@example.test', 1, 'Local browser verification fixture', ${now}, ${now})`,
		`INSERT INTO session (id, expires_at, token, user_id, created_at, updated_at) VALUES ('e2e-session', ${expiresAt}, 'e2e-session-token', 'e2e-user', ${now}, ${now})`,
	].join("; ");
	execFileSync(
		"bunx",
		["wrangler", "d1", "execute", "DB", "--local", "--command", sql],
		{ stdio: "pipe" },
	);
	const signedCookie = await serializeSignedCookie(
		"better-auth.session_token",
		"e2e-session-token",
		secret,
	);
	const cookieValue = signedCookie
		.split(";", 1)[0]
		?.split("=")
		.slice(1)
		.join("=");
	if (!cookieValue) throw new Error("Failed to create local session cookie");
	writeFileSync(
		authStatePath,
		JSON.stringify({
			cookies: [
				{
					name: "better-auth.session_token",
					value: cookieValue,
					domain: "127.0.0.1",
					path: "/",
					expires: Math.floor(expiresAt / 1000),
					httpOnly: true,
					secure: false,
					sameSite: "Lax",
				},
			],
			origins: [],
		}),
	);
}
