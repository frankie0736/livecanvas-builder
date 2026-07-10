import { afterEach, describe, expect, it } from "bun:test";

import { decideRouteAccess } from "@/server/auth/route-policy";
import { createD1TestHarness } from "@/server/db/__tests__/d1-test-harness";
import { createProjectRepository } from "@/server/repositories/project-repository";

const disposers: Array<() => Promise<void>> = [];

afterEach(async () => {
	await Promise.all(disposers.splice(0).map((dispose) => dispose()));
});

const session = {
	session: { id: "session-1", userId: "user-1" },
	user: { id: "user-1" },
};

describe("route authorization policy", () => {
	it("redirects anonymous users away from protected routes", () => {
		expect(
			decideRouteAccess("protected", null, "/profile/my-projects"),
		).toEqual({
			to: "/signin",
			search: { redirect: "/profile/my-projects" },
		});
	});

	it("redirects authenticated users away from guest entry routes", () => {
		expect(decideRouteAccess("guest", session, "/signin")).toEqual({
			to: "/dashboard",
		});
	});

	it("allows the matching session state and always-public routes", () => {
		expect(decideRouteAccess("protected", session, "/dashboard")).toBeNull();
		expect(decideRouteAccess("guest", null, "/signin")).toBeNull();
		expect(decideRouteAccess("public", session, "/privacy-policy")).toBeNull();
		expect(decideRouteAccess("public", null, "/privacy-policy")).toBeNull();
	});

	it("derives project ownership from the session user id", async () => {
		const harness = await createD1TestHarness();
		disposers.push(harness.dispose);
		const now = Date.now();
		await harness.database.batch([
			harness.database
				.prepare(
					"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.bind("owner", "Owner", "owner@example.test", 1, now, now),
			harness.database
				.prepare(
					"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.bind("other", "Other", "other@example.test", 1, now, now),
		]);
		await harness.database
			.prepare(
				"INSERT INTO project (id, title, html_content, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind("project-1", "Private", "<main />", "owner", now, now)
			.run();
		const repository = createProjectRepository(harness.database);

		expect(
			await repository.getOwnedProject("owner", "project-1"),
		).not.toBeNull();
		expect(await repository.getOwnedProject("other", "project-1")).toBeNull();
	});
});
