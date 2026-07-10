import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { getRouter } from "../../router";
import {
	APP_ROUTES,
	PROTECTED_ROUTES,
	WORKER_BINDINGS,
} from "../route-manifest";

const expectedRoutes = [
	"/",
	"/api/auth/$",
	"/api/chat",
	"/api/media/$",
	"/api/metadata",
	"/api/models/aihubmix",
	"/api/task/cancel",
	"/api/task/status",
	"/api/task/submit",
	"/chat",
	"/dashboard",
	"/example",
	"/gallery",
	"/preview",
	"/privacy-policy",
	"/profile",
	"/profile/api-keys",
	"/profile/favorites-projects",
	"/profile/my-projects",
	"/signin",
	"/signout",
	"/terms-of-service",
	"/wizard",
] as const;

describe("TanStack Start migration manifest", () => {
	it("preserves every existing page and API path", () => {
		expect([...APP_ROUTES].sort()).toEqual([...expectedRoutes].sort());
		expect(Object.keys(getRouter().routesByPath).sort()).toEqual(
			[...expectedRoutes].sort(),
		);
	});

	it("places authenticated pages under one pathless layout", () => {
		const router = getRouter();

		for (const path of PROTECTED_ROUTES) {
			expect(router.routesByPath[path]?.id).toStartWith("/_protected");
		}
	});

	it("uses only the local Cloudflare binding contract", () => {
		expect(WORKER_BINDINGS).toEqual(["DB", "ASSETS", "CHAT_GENERATION"]);

		const config = JSON.parse(
			readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8"),
		) as {
			d1_databases: Array<{ binding: string }>;
			r2_buckets: Array<{ binding: string }>;
			workflows: Array<{ binding: string }>;
		};
		const configuredBindings = [
			...config.d1_databases,
			...config.r2_buckets,
			...config.workflows,
		].map(({ binding }) => binding);

		expect(configuredBindings.sort()).toEqual([...WORKER_BINDINGS].sort());
	});
});
