import { expect, test } from "@playwright/test";
import { monitorPage } from "./monitor";

test("@auth loads the authenticated product surfaces", async ({
	page,
}, testInfo) => {
	const errors = monitorPage(page);
	await page.goto("/dashboard");
	await expect(page.getByText("无响应", { exact: true })).toBeVisible();
	await expect(
		page.getByPlaceholder("输入你的提示词，例如：生成一个简单的按钮..."),
	).toBeVisible();

	await page.goto("/gallery");
	await expect(page.locator("main")).toBeVisible();
	await expect(page.locator("main img").first()).toBeVisible();

	await page.goto("/profile");
	await expect(
		page.getByText("Local Test User", { exact: true }).first(),
	).toBeVisible();
	await expect(
		page.getByText("local-e2e@example.test", { exact: true }).first(),
	).toBeVisible();

	await page.goto("/profile/my-projects");
	await expect(
		page.getByText("我的项目", { exact: true }).last(),
	).toBeVisible();
	await page.goto("/profile/favorites-projects");
	await expect(
		page.getByText("Favorite Projects", { exact: true }),
	).toBeVisible();

	await page.goto("/profile/api-keys");
	await page.waitForFunction(
		() => (window as Window & { $_TSR?: unknown }).$_TSR === undefined,
	);
	const keyInput = page.getByLabel("AIHubMix API密钥");
	await keyInput.fill("local-e2e-key");
	await page.getByRole("button", { name: "保存" }).click();
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem("aihubmix_api_key")))
		.not.toBeNull();
	await page.reload();
	await expect(keyInput).toHaveValue("local-e2e-key");

	await page.goto("/chat");
	await expect(
		page.getByRole("heading", { name: "WordPress ACF & LNL Generator" }),
	).toBeVisible();
	await page.goto("/wizard");
	await expect(page.locator("main, .container").first()).toBeVisible();

	const staleDialogueStore = JSON.stringify({
		state: {
			dialogues: [
				{
					id: 1,
					submissions: [
						{
							id: 1,
							input: {
								prompt: "Preview fixture",
								providerId: "aihubmix",
								modelId: "gpt-5.6-sol",
								apiKey: "local-e2e-key",
								dialogueId: 1,
								submissionId: 1,
							},
							response: {
								taskId: "e2e-preview-task",
								status: "COMPLETED",
								code: "<section>Stale local preview</section>",
								advices: [],
							},
							isLoading: false,
						},
					],
					activeSubmissionId: 1,
					selectedProviderId: "aihubmix",
					selectedModelId: "gpt-5.6-sol",
				},
			],
			activeDialogueId: 1,
			defaultProviderId: "aihubmix",
			defaultModelId: "gpt-5.6-sol",
		},
		version: 0,
	});
	await page.addInitScript((store) => {
		localStorage.setItem("dialogue-storage", store);
	}, staleDialogueStore);
	await page.goto("/dashboard");
	await expect(page.getByRole("link", { name: "预览" })).toHaveAttribute(
		"href",
		"/preview?taskId=e2e-preview-task",
	);

	await page.goto("/preview?taskId=e2e-preview-task");
	const preview = page.locator('iframe[title="UI 预览"]');
	await expect(preview).toBeVisible();
	await expect(
		page
			.frameLocator('iframe[title="UI 预览"]')
			.getByTestId("canonical-preview"),
	).toHaveText("Preview task output");
	const deniedTask = await page.request.get(
		"/api/task/status?taskId=e2e-other-preview-task",
	);
	expect(deniedTask.status()).toBe(404);
	await page.screenshot({
		path: testInfo.outputPath("authenticated-desktop.png"),
		fullPage: true,
	});
	expect(errors).toEqual([]);
});

test("@mobile has no horizontal overflow on primary views", async ({
	page,
}, testInfo) => {
	const errors = monitorPage(page);
	for (const path of [
		"/dashboard",
		"/gallery",
		"/profile",
		"/wizard",
	] as const) {
		await page.goto(path);
		await expect(page.locator("body")).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth,
		);
		expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
	}
	await page.screenshot({
		path: testInfo.outputPath("authenticated-mobile.png"),
		fullPage: true,
	});
	expect(errors).toEqual([]);
});
