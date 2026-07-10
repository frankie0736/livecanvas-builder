import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";

import { resolveNeonSnapshotUrl } from "../../src/migration/source-url";
import {
	type SourceTable,
	readEnvironment,
	runQuiet,
	sha256File,
	sourceTables,
} from "./shared";

const { values } = parseArgs({
	options: {
		env: { type: "string" },
		output: { type: "string" },
	},
	strict: true,
});

if (!values.env || !values.output) {
	throw new Error("snapshot requires --env and --output");
}

const environment = await readEnvironment(values.env);
const databaseUrl = environment.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");
const snapshotDatabaseUrl = resolveNeonSnapshotUrl(databaseUrl);
const outputDirectory = resolve(values.output);
const postgresCommand = Bun.which("postgres");
if (!postgresCommand) throw new Error("PostgreSQL client tools are missing");
const postgresBin = dirname(postgresCommand);
const tool = (name: string) => join(postgresBin, name);

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const dumpPath = join(outputDirectory, "postgres.dump");
await runQuiet(
	[
		tool("pg_dump"),
		"--format=custom",
		"--no-owner",
		"--no-privileges",
		`--dbname=${snapshotDatabaseUrl}`,
		`--file=${dumpPath}`,
	],
	{
		label: "pg_dump",
		diagnosticPath: join(outputDirectory, "pg_dump"),
	},
);
await chmod(dumpPath, 0o600);

const restoreRoot = await mkdtemp(join(outputDirectory, "restore-"));
if (dirname(restoreRoot) !== outputDirectory) {
	throw new Error("temporary restore directory escaped snapshot output");
}
const dataDirectory = join(restoreRoot, "data");
const socketDirectory = join(restoreRoot, "socket");
const restoreLog = join(restoreRoot, "postgres.log");
const port = 49_152 + (process.pid % 10_000);
const databaseName = "snapshot";
const serverOptions = `-k '${socketDirectory.replaceAll("'", "'\\''")}' -p ${port} -c listen_addresses=`;

let serverStarted = false;
let manifest:
	| {
			version: number;
			createdAt: string;
			tables: Record<
				SourceTable,
				{ file: string; count: number; sha256: string }
			>;
			dump: { file: string; sha256: string };
			purchaseCountMismatches: { count: number; sha256: string };
	  }
	| undefined;
const errors: unknown[] = [];

try {
	await mkdir(socketDirectory, { mode: 0o700 });
	await runQuiet(
		[
			tool("initdb"),
			`--pgdata=${dataDirectory}`,
			"--username=postgres",
			"--auth=trust",
			"--encoding=UTF8",
			"--no-locale",
		],
		{
			label: "initdb",
			diagnosticPath: join(restoreRoot, "initdb"),
		},
	);
	await runQuiet(
		[
			tool("pg_ctl"),
			`--pgdata=${dataDirectory}`,
			"--wait",
			`--log=${restoreLog}`,
			`--options=${serverOptions}`,
			"start",
		],
		{
			label: "local PostgreSQL start",
			diagnosticPath: join(restoreRoot, "pg_ctl-start"),
		},
	);
	serverStarted = true;
	await chmod(restoreLog, 0o600);
	await runQuiet(
		[
			tool("createdb"),
			`--host=${socketDirectory}`,
			`--port=${port}`,
			"--username=postgres",
			databaseName,
		],
		{
			label: "local database creation",
			diagnosticPath: join(restoreRoot, "createdb"),
		},
	);
	await runQuiet(
		[
			tool("pg_restore"),
			`--host=${socketDirectory}`,
			`--port=${port}`,
			"--username=postgres",
			`--dbname=${databaseName}`,
			"--no-owner",
			"--no-privileges",
			"--exit-on-error",
			dumpPath,
		],
		{
			label: "local PostgreSQL restore",
			diagnosticPath: join(restoreRoot, "pg_restore"),
		},
	);

	const restored = postgres({
		host: socketDirectory,
		port,
		database: databaseName,
		username: "postgres",
		max: 1,
		prepare: false,
	});
	try {
		manifest = await restored.begin(
			"isolation level repeatable read read only",
			async (transaction) => {
				const tables = {} as Record<
					SourceTable,
					{ file: string; count: number; sha256: string }
				>;
				for (const [logicalName, definition] of Object.entries(
					sourceTables,
				) as Array<[SourceTable, (typeof sourceTables)[SourceTable]]>) {
					const rows = await transaction`
						SELECT * FROM ${transaction(definition.table)}
						ORDER BY ${transaction(definition.key)}
					`;
					const filename = `${logicalName}.json`;
					const path = join(outputDirectory, filename);
					await writeFile(path, JSON.stringify([...rows]), { mode: 0o600 });
					tables[logicalName] = {
						file: filename,
						count: rows.length,
						sha256: await sha256File(path),
					};
				}

				const mismatchRows = await transaction<{ id: string }[]>`
					SELECT p."id"
					FROM "lc_builder_project" p
					LEFT JOIN (
						SELECT "projectId", count(*)::integer AS count
						FROM "lc_builder_purchase"
						GROUP BY "projectId"
					) counts ON counts."projectId" = p."id"
					WHERE p."purchaseCount" <> COALESCE(counts.count, 0)
					ORDER BY p."id"
				`;
				const mismatchIds = mismatchRows.map(({ id }) => id);

				return {
					version: 1,
					createdAt: new Date().toISOString(),
					tables,
					dump: {
						file: "postgres.dump",
						sha256: await sha256File(dumpPath),
					},
					purchaseCountMismatches: {
						count: mismatchIds.length,
						sha256: createHash("sha256")
							.update(JSON.stringify(mismatchIds))
							.digest("hex"),
					},
				};
			},
		);
	} finally {
		await restored.end();
	}
} catch (error) {
	errors.push(error);
}

if (serverStarted) {
	try {
		await runQuiet(
			[tool("pg_ctl"), `--pgdata=${dataDirectory}`, "--wait", "stop"],
			{
				label: "local PostgreSQL stop",
				diagnosticPath: join(restoreRoot, "pg_ctl-stop"),
			},
		);
	} catch (error) {
		errors.push(error);
	}
}

try {
	await rm(restoreRoot, { recursive: true });
} catch (error) {
	errors.push(error);
}

if (errors.length === 1) throw errors[0];
if (errors.length > 1) {
	throw new AggregateError(
		errors,
		"snapshot failed and cleanup was incomplete",
	);
}
if (!manifest) throw new Error("snapshot manifest was not created");

await writeFile(
	join(outputDirectory, "manifest.json"),
	JSON.stringify(manifest, null, 2),
	{ mode: 0o600 },
);
console.log(
	`snapshot ok tables=${Object.values(manifest.tables).reduce((sum, table) => sum + table.count, 0)} dump=1`,
);
