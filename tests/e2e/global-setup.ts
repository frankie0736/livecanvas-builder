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
	const previewResult = JSON.stringify({
		code: '<section data-testid="canonical-preview">Preview task output</section>',
		advices: [],
	});
	const sql = [
		"DELETE FROM generation_task WHERE id IN ('e2e-preview-task', 'e2e-other-preview-task')",
		"DELETE FROM session WHERE user_id IN ('e2e-user', 'e2e-other-user')",
		"DELETE FROM user WHERE id IN ('e2e-user', 'e2e-other-user')",
		`INSERT INTO user (id, name, email, email_verified, background_info, created_at, updated_at) VALUES ('e2e-user', 'Local Test User', 'local-e2e@example.test', 1, 'Local browser verification fixture', ${now}, ${now})`,
		`INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('e2e-other-user', 'Other Test User', 'other-e2e@example.test', 1, ${now}, ${now})`,
		`INSERT INTO session (id, expires_at, token, user_id, created_at, updated_at) VALUES ('e2e-session', ${expiresAt}, 'e2e-session-token', 'e2e-user', ${now}, ${now})`,
		`INSERT INTO generation_task (id, user_id, workflow_instance_id, status, model, encrypted_payload, result, created_at, updated_at, completed_at) VALUES ('e2e-preview-task', 'e2e-user', 'e2e-preview-task', 'COMPLETED', 'gpt-5.6-sol', '', '${previewResult}', ${now}, ${now}, ${now})`,
		`INSERT INTO generation_task (id, user_id, workflow_instance_id, status, model, encrypted_payload, result, created_at, updated_at, completed_at) VALUES ('e2e-other-preview-task', 'e2e-other-user', 'e2e-other-preview-task', 'COMPLETED', 'gpt-5.6-sol', '', '${previewResult}', ${now}, ${now}, ${now})`,
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
