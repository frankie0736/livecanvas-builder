import { env } from "cloudflare:workers";

import { createAuth } from "./config";

export const auth = createAuth(env);

export type AuthSession = typeof auth.$Infer.Session;

export async function getSession(headers: Headers) {
	return auth.api.getSession({ headers });
}

export async function requireSession(headers: Headers) {
	const session = await getSession(headers);
	if (!session) throw new UnauthorizedError();
	return session;
}

export class UnauthorizedError extends Error {
	constructor() {
		super("Unauthorized");
		this.name = "UnauthorizedError";
	}
}
