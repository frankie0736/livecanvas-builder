import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { targetColumns } from "../../src/migration/sql";
import {
	type TargetData,
	canonicalHash,
	transformSnapshot,
} from "../../src/migration/transform";
import { runJson, sha256File, sourceTables } from "./shared";

const { values } = parseArgs({
	options: { input: { type: "string" } },
	strict: true,
});
if (!values.input) throw new Error("verify-local requires --input");

const manifest = JSON.parse(
	await readFile(join(values.input, "manifest.json"), "utf8"),
) as {
	tables: Record<string, { file: string; count: number; sha256: string }>;
	dump: { file: string; sha256: string };
	purchaseCountMismatches: { count: number; sha256: string };
};
for (const table of Object.values(manifest.tables)) {
	if ((await sha256File(join(values.input, table.file))) !== table.sha256) {
		throw new Error("Snapshot table hash mismatch");
	}
}
if (
	(await sha256File(join(values.input, manifest.dump.file))) !==
	manifest.dump.sha256
) {
	throw new Error("PostgreSQL dump hash mismatch");
}

const source = {} as Record<string, unknown>;
for (const logicalName of Object.keys(sourceTables)) {
	source[logicalName] = JSON.parse(
		await readFile(join(values.input, `${logicalName}.json`), "utf8"),
	);
}
const expected = transformSnapshot(source as never);
const tableResults = {} as Record<
	keyof TargetData,
	{ count: number; sha256: string }
>;

for (const table of Object.keys(targetColumns) as Array<keyof TargetData>) {
	const response = await runJson([
		"bunx",
		"wrangler",
		"d1",
		"execute",
		"DB",
		"--local",
		"--json",
		"--command",
		`SELECT ${targetColumns[table].join(",")} FROM ${table} ORDER BY id`,
	]);
	const rows = response[0]?.results ?? [];
	const expectedRows = expected[table];
	if (
		rows.length !== expectedRows.length ||
		canonicalHash(rows) !== canonicalHash(expectedRows)
	) {
		throw new Error(`D1 verification failed for ${table}`);
	}
	tableResults[table] = { count: rows.length, sha256: canonicalHash(rows) };
}

const sessionResponse = await runJson([
	"bunx",
	"wrangler",
	"d1",
	"execute",
	"DB",
	"--local",
	"--json",
	"--command",
	"SELECT count(*) AS count FROM session",
]);
if (sessionResponse[0]?.results[0]?.count !== 0) {
	throw new Error("Legacy sessions were imported");
}

const foreignKeyResponse = await runJson([
	"bunx",
	"wrangler",
	"d1",
	"execute",
	"DB",
	"--local",
	"--json",
	"--command",
	"PRAGMA foreign_key_check",
]);
if ((foreignKeyResponse[0]?.results.length ?? 0) !== 0) {
	throw new Error("D1 foreign key verification failed");
}

const mismatchResponse = await runJson([
	"bunx",
	"wrangler",
	"d1",
	"execute",
	"DB",
	"--local",
	"--json",
	"--command",
	"SELECT p.id FROM project p LEFT JOIN (SELECT project_id, count(*) AS count FROM purchase GROUP BY project_id) counts ON counts.project_id = p.id WHERE p.purchase_count <> COALESCE(counts.count, 0) ORDER BY p.id",
]);
const mismatchIds = (mismatchResponse[0]?.results ?? []).map((row) => row.id);
const mismatchHash = createHash("sha256")
	.update(JSON.stringify(mismatchIds))
	.digest("hex");
if (
	mismatchIds.length !== manifest.purchaseCountMismatches.count ||
	mismatchHash !== manifest.purchaseCountMismatches.sha256
) {
	throw new Error("purchaseCount mismatch set changed during migration");
}

await writeFile(
	join(values.input, "d1-verification.json"),
	JSON.stringify(
		{
			verifiedAt: new Date().toISOString(),
			tables: tableResults,
			sessions: 0,
			purchaseCountMismatches: mismatchIds.length,
		},
		null,
		2,
	),
	{ mode: 0o600 },
);
console.log(
	`verify ok tables=${Object.values(tableResults).reduce((sum, table) => sum + table.count, 0)} sessions=0 purchaseCountMismatches=${mismatchIds.length}`,
);
