import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { z } from "zod";

import { createDatabase } from "@/server/db";
import * as schema from "@/server/db/schema";

const authBindingsSchema = z.object({
	AUTH_SECRET: z.string().min(32),
	AUTH_GOOGLE_ID: z.string().min(1),
	AUTH_GOOGLE_SECRET: z.string().min(1),
	AUTH_DISCORD_ID: z.string().min(1),
	AUTH_DISCORD_SECRET: z.string().min(1),
	AUTH_BASE_URL: z.string().url().optional(),
	DB: z.custom<D1Database>(
		(value) => typeof value === "object" && value !== null,
		"DB must be a D1 binding",
	),
});

export type AuthBindings = z.infer<typeof authBindingsSchema>;

export function createAuth(input: unknown) {
	const bindings = authBindingsSchema.parse(input);

	return betterAuth({
		...(bindings.AUTH_BASE_URL ? { baseURL: bindings.AUTH_BASE_URL } : {}),
		secret: bindings.AUTH_SECRET,
		database: drizzleAdapter(createDatabase(bindings.DB), {
			provider: "sqlite",
			schema,
		}),
		socialProviders: {
			google: {
				clientId: bindings.AUTH_GOOGLE_ID,
				clientSecret: bindings.AUTH_GOOGLE_SECRET,
				accessType: "offline",
			},
			discord: {
				clientId: bindings.AUTH_DISCORD_ID,
				clientSecret: bindings.AUTH_DISCORD_SECRET,
				prompt: "consent",
			},
		},
		user: {
			additionalFields: {
				backgroundInfo: {
					type: "string",
					required: false,
					input: false,
				},
			},
		},
		plugins: [tanstackStartCookies()],
	});
}
