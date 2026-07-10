import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";

export const sourceTables = {
	user: { table: "lc_builder_user", key: "id" },
	account: { table: "lc_builder_account", key: "id" },
	session: { table: "lc_builder_session", key: "sessionToken" },
	project: { table: "lc_builder_project", key: "id" },
	purchase: { table: "lc_builder_purchase", key: "id" },
	favorite: { table: "lc_builder_favorite", key: "id" },
} as const;

export type SourceTable = keyof typeof sourceTables;

export async function readEnvironment(path: string) {
	return parse(await readFile(path));
}

export async function sha256File(path: string) {
	return createHash("sha256")
		.update(await readFile(path))
		.digest("hex");
}

export async function runQuiet(
	command: string[],
	options: {
		label: string;
		diagnosticPath: string;
		env?: Record<string, string>;
	},
) {
	const process = Bun.spawn(command, {
		env: { ...Bun.env, ...options.env },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		process.exited,
		new Response(process.stdout).arrayBuffer(),
		new Response(process.stderr).arrayBuffer(),
	]);
	if (exitCode !== 0) {
		await Promise.all([
			writeFile(`${options.diagnosticPath}.stdout`, new Uint8Array(stdout), {
				mode: 0o600,
			}),
			writeFile(`${options.diagnosticPath}.stderr`, new Uint8Array(stderr), {
				mode: 0o600,
			}),
		]);
		throw new Error(`${options.label} failed with exit code ${exitCode}`);
	}
}

export async function runJson(command: string[]) {
	const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
	const [exitCode, stdout] = await Promise.all([
		process.exited,
		new Response(process.stdout).text(),
		new Response(process.stderr).arrayBuffer(),
	]);
	if (exitCode !== 0) {
		throw new Error(`${command[0]} failed with exit code ${exitCode}`);
	}
	return JSON.parse(stdout) as Array<{
		success: boolean;
		results: Array<Record<string, string | number | null>>;
	}>;
}
