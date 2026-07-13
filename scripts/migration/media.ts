import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { getPlatformProxy } from "wrangler";

import {
	type ArchivedMediaObject,
	type MediaManifest,
	canonicalMediaUrl,
	collectOwnedMediaReferences,
	inferMediaType,
	legacyR2Key,
} from "../../src/server/storage/media.ts";
import { readEnvironment, sha256File } from "./shared.ts";

type LocalBindings = { ASSETS: R2Bucket; DB: D1Database };
type InventoryObject = {
	source: "bunny" | "vercel";
	sourceUrl: string;
	downloadUrl: string;
	sourcePath: string;
	r2Key: string;
	archivePath: string;
	referenced: boolean;
	expectedSize?: number;
	accessKey?: string;
};
type VercelBlob = {
	url: string;
	downloadUrl: string;
	pathname: string;
	size: number;
};

const { values, positionals } = parseArgs({
	options: {
		env: { type: "string" },
		output: { type: "string" },
		input: { type: "string" },
	},
	allowPositionals: true,
	strict: true,
});

const mode = positionals[0];
if (
	!(
		[
			"archive",
			"import-local",
			"import-remote",
			"verify-local",
			"verify-remote",
		] as Array<unknown>
	).includes(mode)
) {
	throw new Error(
		"media migration requires archive, import-local, import-remote, verify-local, or verify-remote",
	);
}

function sha256Bytes(value: ArrayBuffer | ArrayBufferView) {
	return createHash("sha256")
		.update(
			ArrayBuffer.isView(value)
				? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
				: new Uint8Array(value),
		)
		.digest("hex");
}

function sha256Strings(values: string[]) {
	return createHash("sha256").update(values.join("\n")).digest("hex");
}

async function readJson<T>(path: string) {
	return JSON.parse(await readFile(path, "utf8")) as T;
}

async function readManifest(path: string) {
	return readJson<MediaManifest>(path);
}

async function readPreviousManifest(path: string) {
	try {
		return await readManifest(path);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return undefined;
		}
		throw error;
	}
}

async function writeManifest(path: string, manifest: MediaManifest) {
	const temporaryPath = `${path}.next`;
	await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), {
		mode: 0o600,
	});
	await rename(temporaryPath, path);
}

function archiveFilePath(root: string, archivePath: string) {
	const path = resolve(root, archivePath);
	if (!path.startsWith(`${root}${sep}`)) {
		throw new Error("media archive path escaped the private output directory");
	}
	return path;
}

async function inBatches<T, R>(
	values: T[],
	batchSize: number,
	transform: (value: T) => Promise<R>,
	onBatch?: (results: R[]) => Promise<void>,
) {
	const output: R[] = [];
	for (let index = 0; index < values.length; index += batchSize) {
		const results = await Promise.all(
			values.slice(index, index + batchSize).map(transform),
		);
		output.push(...results);
		await onBatch?.(results);
	}
	return output;
}

async function sourceReferences(root: string) {
	const [users, projects] = await Promise.all([
		readJson<Array<{ image?: unknown }>>(join(root, "user.json")),
		readJson<Array<{ thumbnail?: unknown }>>(join(root, "project.json")),
	]);
	return collectOwnedMediaReferences(users, projects);
}

async function listVercelBlobs(token: string) {
	const { list } = await import("@vercel/blob");
	const blobs: VercelBlob[] = [];
	let cursor: string | undefined;
	do {
		const page = await list({ token, cursor, limit: 1_000 });
		blobs.push(...page.blobs);
		cursor = page.hasMore ? page.cursor : undefined;
	} while (cursor);
	return blobs;
}

async function downloadToFile(item: InventoryObject, path: string) {
	try {
		let response: Response | undefined;
		// Remove the bounded transport retry after the source archive is retired.
		for (let attempt = 0; attempt < 10; attempt += 1) {
			try {
				response = await fetch(item.downloadUrl, {
					headers: item.accessKey ? { AccessKey: item.accessKey } : undefined,
				});
				break;
			} catch (error) {
				const cause =
					typeof error === "object" && error !== null && "cause" in error
						? error.cause
						: undefined;
				const code =
					typeof cause === "object" && cause !== null && "code" in cause
						? cause.code
						: undefined;
				if (code !== "ECONNRESET" || attempt === 9) throw error;
				await new Promise((resolvePromise) =>
					setTimeout(resolvePromise, 2_000),
				);
			}
		}
		if (!response) throw new Error("media source returned no response");
		if (!response.ok) {
			throw new Error(`media source returned status=${response.status}`);
		}
		await writeFile(path, new Uint8Array(await response.arrayBuffer()), {
			mode: 0o600,
		});
		return {
			exitCode: 0,
			contentType: response.headers.get("content-type") ?? "",
			stderr: new Uint8Array(),
		};
	} catch (error) {
		const diagnostic = JSON.stringify({
			name: error instanceof Error ? error.name : "UnknownError",
			message:
				error instanceof Error ? error.message : "media source download failed",
		});
		return {
			exitCode: 1,
			contentType: "",
			stderr: new TextEncoder().encode(diagnostic),
		};
	}
}

async function archiveObject(
	root: string,
	item: InventoryObject,
	previous?: ArchivedMediaObject,
) {
	const path = archiveFilePath(root, item.archivePath);
	if (previous) {
		try {
			const file = await stat(path);
			if (
				file.size === previous.size &&
				(item.expectedSize === undefined || file.size === item.expectedSize) &&
				(await sha256File(path)) === previous.sha256
			) {
				return { ...previous, referenced: item.referenced };
			}
		} catch (error) {
			if (
				!(error instanceof Error && "code" in error && error.code === "ENOENT")
			) {
				throw error;
			}
		}
	}

	await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
	const temporaryPath = `${path}.download`;
	const { exitCode, contentType, stderr } = await downloadToFile(
		item,
		temporaryPath,
	);
	if (exitCode !== 0) {
		const diagnosticDirectory = join(root, "media", "download-errors");
		await mkdir(diagnosticDirectory, { recursive: true, mode: 0o700 });
		const diagnosticName = createHash("sha256")
			.update(item.sourceUrl)
			.digest("hex");
		await writeFile(
			join(diagnosticDirectory, `${diagnosticName}.stderr`),
			stderr,
			{ mode: 0o600 },
		);
		throw new Error(
			`${item.source} media download failed with exit code ${exitCode}`,
		);
	}
	const file = await stat(temporaryPath);
	if (item.expectedSize !== undefined && file.size !== item.expectedSize) {
		throw new Error(`${item.source} media size changed during archive`);
	}
	const sha256 = await sha256File(temporaryPath);
	await rename(temporaryPath, path);
	return {
		source: item.source,
		sourceUrl: item.sourceUrl,
		sourcePath: item.sourcePath,
		archivePath: item.archivePath,
		r2Key: item.r2Key,
		contentType: inferMediaType(item.sourcePath, contentType),
		size: file.size,
		sha256,
		referenced: item.referenced,
	} satisfies ArchivedMediaObject;
}

async function archiveMedia() {
	if (!values.env || !values.output) {
		throw new Error("archive-media requires --env and --output");
	}
	const root = resolve(values.output);
	await mkdir(root, { recursive: true, mode: 0o700 });
	const environment = await readEnvironment(values.env);
	const token = environment.BLOB_READ_WRITE_TOKEN;
	if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is missing");
	const bunnyStorageKey = environment.BUNNY_STORAGE_API_KEY;

	const [references, blobs] = await Promise.all([
		sourceReferences(root),
		listVercelBlobs(token),
	]);
	const blobByUrl = new Map(
		blobs.map((blob) => [canonicalMediaUrl(blob.url), blob]),
	);
	if (blobByUrl.size !== blobs.length) {
		throw new Error("Vercel Blob inventory contains duplicate URLs");
	}
	const referencedVercel = [...references].filter(
		([, source]) => source === "vercel",
	);
	const missingVercel = referencedVercel.filter(
		([sourceUrl]) => !blobByUrl.has(sourceUrl),
	);
	if (missingVercel.length > 0) {
		throw new Error(
			`Vercel Blob inventory is missing ${missingVercel.length} database references`,
		);
	}

	const inventory: InventoryObject[] = blobs.map((blob) => {
		const sourceUrl = canonicalMediaUrl(blob.url);
		const r2Key = legacyR2Key(sourceUrl, blob.pathname);
		return {
			source: "vercel",
			sourceUrl,
			downloadUrl: blob.downloadUrl,
			sourcePath: blob.pathname,
			r2Key,
			archivePath: `media/archive/${r2Key}`,
			referenced: references.has(sourceUrl),
			expectedSize: blob.size,
		};
	});
	for (const [sourceUrl, source] of references) {
		if (source !== "bunny") continue;
		if (!bunnyStorageKey) throw new Error("BUNNY_STORAGE_API_KEY is missing");
		const sourceAddress = new URL(sourceUrl);
		const zone = sourceAddress.hostname.slice(0, -".b-cdn.net".length);
		if (!/^[a-z0-9-]+$/.test(zone)) {
			throw new Error("Bunny media URL has an invalid storage zone");
		}
		const r2Key = legacyR2Key(sourceUrl);
		inventory.push({
			source,
			sourceUrl,
			downloadUrl: `https://storage.bunnycdn.com/${zone}${sourceAddress.pathname}`,
			sourcePath: sourceAddress.pathname,
			r2Key,
			archivePath: `media/archive/${r2Key}`,
			referenced: true,
			accessKey: bunnyStorageKey,
		});
	}
	inventory.sort((left, right) =>
		left.sourceUrl.localeCompare(right.sourceUrl),
	);
	const keySet = new Set(inventory.map(({ r2Key }) => r2Key));
	if (keySet.size !== inventory.length) {
		throw new Error("media inventory maps multiple sources to one R2 key");
	}

	const manifestPath = join(root, "media-manifest.json");
	const previous = await readPreviousManifest(manifestPath);
	const archivedByUrl = new Map(
		previous?.objects.map((object) => [object.sourceUrl, object]) ?? [],
	);
	const now = new Date().toISOString();
	const manifest: MediaManifest = {
		version: 1,
		createdAt: previous?.createdAt ?? now,
		updatedAt: now,
		complete: false,
		inventory: {
			vercel: blobs.length,
			bunny: inventory.filter(({ source }) => source === "bunny").length,
			referencedVercel: referencedVercel.length,
			referencedBunny: [...references.values()].filter(
				(source) => source === "bunny",
			).length,
		},
		objects: [],
	};

	let completed = 0;
	const recordBatch = async (objects: ArchivedMediaObject[]) => {
		for (const object of objects) archivedByUrl.set(object.sourceUrl, object);
		completed += objects.length;
		manifest.objects = inventory
			.map(({ sourceUrl }) => archivedByUrl.get(sourceUrl))
			.filter((object): object is ArchivedMediaObject => object !== undefined);
		manifest.updatedAt = new Date().toISOString();
		await writeManifest(manifestPath, manifest);
		if (completed % 64 === 0 || completed === inventory.length) {
			console.log(
				`archive progress completed=${completed} total=${inventory.length}`,
			);
		}
	};
	const archive = (item: InventoryObject) =>
		archiveObject(root, item, archivedByUrl.get(item.sourceUrl));
	// Remove source-specific serialization after the one-time Bunny archive is retired.
	await inBatches(
		inventory.filter(({ source }) => source === "bunny"),
		1,
		archive,
		recordBatch,
	);
	await inBatches(
		inventory.filter(({ source }) => source === "vercel"),
		2,
		archive,
		recordBatch,
	);
	manifest.complete = true;
	manifest.updatedAt = new Date().toISOString();
	await writeManifest(manifestPath, manifest);
	console.log(
		`archive ok vercel=${manifest.inventory.vercel} bunny=${manifest.inventory.bunny} referenced=${manifest.objects.filter(({ referenced }) => referenced).length} orphaned=${manifest.objects.filter(({ referenced }) => !referenced).length}`,
	);
}

type MediaTarget = "local" | "remote";

function targetEnvironment(target: MediaTarget) {
	if (target === "local") return undefined;
	if (!values.env) throw new Error("remote media migration requires --env");
	return values.env;
}

async function platformProxy() {
	return getPlatformProxy<LocalBindings>({
		configPath: resolve("wrangler.jsonc"),
		envFiles: [".dev.vars.example"],
		persist: true,
		remoteBindings: false,
	});
}

async function remoteR2Target() {
	const environment = targetEnvironment("remote");
	const config = await readJson<{
		env?: Record<
			string,
			{ r2_buckets?: Array<{ binding: string; bucket_name: string }> }
		>;
	}>(resolve("wrangler.jsonc"));
	const bucket = config.env?.[environment]?.r2_buckets?.find(
		({ binding }) => binding === "ASSETS",
	);
	if (!bucket)
		throw new Error(`missing ASSETS R2 binding for env=${environment}`);
	return { environment, bucketName: bucket.bucket_name };
}

async function runWrangler(environment: string, args: string[]) {
	let lastFailure: { errorOutput: Buffer; code: number | null } | undefined;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const child = spawn("wrangler", args, {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 60_000,
		});
		const stdout = new Promise<Buffer>((resolvePromise, reject) => {
			const chunks: Buffer[] = [];
			child.stdout.on("data", (chunk) => chunks.push(chunk));
			child.stdout.on("error", reject);
			child.stdout.on("end", () => resolvePromise(Buffer.concat(chunks)));
		});
		const stderr = new Promise<Buffer>((resolvePromise, reject) => {
			const chunks: Buffer[] = [];
			child.stderr.on("data", (chunk) => chunks.push(chunk));
			child.stderr.on("error", reject);
			child.stderr.on("end", () => resolvePromise(Buffer.concat(chunks)));
		});
		const exitCode = new Promise<number | null>((resolvePromise, reject) => {
			child.on("error", reject);
			child.on("close", resolvePromise);
		});
		const [output, errorOutput, code] = await Promise.all([
			stdout,
			stderr,
			exitCode,
		]);
		if (code === 0) return output;
		lastFailure = { errorOutput, code };
		if (attempt < 2) {
			await new Promise((resolvePromise) =>
				setTimeout(resolvePromise, 1_000 * 2 ** attempt),
			);
		}
	}
	if (lastFailure) {
		const digest = createHash("sha256").update(args.join("\0")).digest("hex");
		const diagnosticDirectory = join(
			".migration/private",
			`${environment}-logs`,
		);
		await mkdir(diagnosticDirectory, { recursive: true, mode: 0o700 });
		const diagnosticPath = join(
			diagnosticDirectory,
			`wrangler-${digest}.stderr`,
		);
		await writeFile(diagnosticPath, lastFailure.errorOutput, { mode: 0o600 });
		const status = lastFailure.errorOutput
			.toString("utf8")
			.match(/\b[45]\d\d\b/)?.[0];
		throw new Error(
			`wrangler command failed exit_code=${lastFailure.code} http_status=${status ?? "unknown"} diagnostic=${diagnosticPath}`,
		);
	}
	throw new Error("wrangler command did not produce a result");
}

async function listR2Keys(bucket: R2Bucket, prefix: string) {
	const keys: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await bucket.list({ prefix, cursor });
		keys.push(...page.objects.map(({ key }) => key));
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
	return keys.sort();
}

async function r2ObjectMatches(
	bucket: R2Bucket,
	expected: ArchivedMediaObject,
) {
	const object = await bucket.head(expected.r2Key);
	return (
		object !== null &&
		object.size === expected.size &&
		object.httpMetadata?.contentType === expected.contentType &&
		object.customMetadata?.sha256 === expected.sha256
	);
}

async function importMedia(target: MediaTarget) {
	if (!values.input) throw new Error(`import-media-${target} requires --input`);
	const root = resolve(values.input);
	const manifest = await readManifest(join(root, "media-manifest.json"));
	if (!manifest.complete) throw new Error("media archive is incomplete");
	const expected = manifest.objects.filter(({ referenced }) => referenced);
	if (target === "remote") {
		const remote = await remoteR2Target();
		let completed = 0;
		await inBatches(
			expected,
			// Concurrent Wrangler R2 writes produced partial remote objects.
			1,
			async (object) => {
				await runWrangler(remote.environment, [
					"r2",
					"object",
					"put",
					`${remote.bucketName}/${object.r2Key}`,
					"--remote",
					"--env",
					remote.environment,
					"--file",
					archiveFilePath(root, object.archivePath),
					"--content-type",
					object.contentType,
				]);
			},
			async (objects) => {
				completed += objects.length;
				if (completed % 64 === 0 || completed === expected.length) {
					console.log(
						`remote R2 import progress completed=${completed} total=${expected.length}`,
					);
				}
			},
		);
		console.log(`remote R2 import ok objects=${expected.length}`);
		return;
	}
	const expectedKeys = new Set(expected.map(({ r2Key }) => r2Key));
	const proxy = await platformProxy();
	try {
		const staleKeys = (await listR2Keys(proxy.env.ASSETS, "legacy/")).filter(
			(key) => !expectedKeys.has(key),
		);
		if (staleKeys.length > 0) await proxy.env.ASSETS.delete(staleKeys);
		let completed = 0;
		let uploaded = 0;
		await inBatches(
			expected,
			8,
			async (object) => {
				if (await r2ObjectMatches(proxy.env.ASSETS, object)) return false;
				const body = await readFile(archiveFilePath(root, object.archivePath));
				await proxy.env.ASSETS.put(object.r2Key, body, {
					httpMetadata: { contentType: object.contentType },
					customMetadata: {
						sha256: object.sha256,
						source: object.source,
					},
				});
				return true;
			},
			async (results) => {
				const objects = results.filter(Boolean);
				completed += results.length;
				uploaded += objects.length;
				if (completed % 64 === 0 || completed === expected.length) {
					console.log(
						`${target} R2 import progress completed=${completed} uploaded=${uploaded} total=${expected.length}`,
					);
				}
			},
		);
	} finally {
		await proxy.dispose();
	}
	console.log(`${target} R2 import ok objects=${expected.length}`);
}

async function verifyMedia(target: MediaTarget) {
	if (!values.input) throw new Error(`verify-media-${target} requires --input`);
	const root = resolve(values.input);
	const manifest = await readManifest(join(root, "media-manifest.json"));
	if (!manifest.complete) throw new Error("media archive is incomplete");
	const expected = manifest.objects.filter(({ referenced }) => referenced);
	if (target === "remote") {
		const remote = await remoteR2Target();
		await inBatches(expected, 2, async (object) => {
			const body = await runWrangler(remote.environment, [
				"r2",
				"object",
				"get",
				`${remote.bucketName}/${object.r2Key}`,
				"--remote",
				"--env",
				remote.environment,
				"--pipe",
			]);
			const actualSha256 = sha256Bytes(body);
			if (body.byteLength !== object.size || actualSha256 !== object.sha256) {
				throw new Error(
					`remote R2 object failed byte verification key=${object.r2Key} expected_size=${object.size} actual_size=${body.byteLength} expected_sha256=${object.sha256} actual_sha256=${actualSha256}`,
				);
			}
		});
		const [users, projects] = await Promise.all([
			runWrangler(remote.environment, [
				"d1",
				"execute",
				"DB",
				"--remote",
				"--env",
				remote.environment,
				"--command",
				"SELECT image FROM user WHERE image IS NOT NULL",
				"--json",
			]),
			runWrangler(remote.environment, [
				"d1",
				"execute",
				"DB",
				"--remote",
				"--env",
				remote.environment,
				"--command",
				"SELECT thumbnail FROM project WHERE thumbnail IS NOT NULL",
				"--json",
			]),
		]);
		const rows = (output: Buffer) => {
			const result = JSON.parse(output.toString("utf8")) as Array<{
				results: Array<Record<string, string>>;
			}>;
			return result.flatMap(({ results }) => results);
		};
		const databaseReferences = collectOwnedMediaReferences(
			rows(users),
			rows(projects),
		);
		const manifestReferences = new Set(
			expected.map(({ sourceUrl }) => sourceUrl),
		);
		if (
			databaseReferences.size !== manifestReferences.size ||
			[...databaseReferences.keys()].some(
				(sourceUrl) => !manifestReferences.has(sourceUrl),
			)
		) {
			throw new Error("D1 media URL mapping is incomplete");
		}
		console.log(
			`remote R2 verify ok objects=${expected.length} missingMappings=0`,
		);
		return;
	}
	const expectedKeys = expected.map(({ r2Key }) => r2Key).sort();
	const proxy = await platformProxy();
	try {
		const actualKeys = await listR2Keys(proxy.env.ASSETS, "legacy/");
		if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
			throw new Error(
				`${target} R2 key set does not match media manifest expected_count=${expectedKeys.length} actual_count=${actualKeys.length} expected_digest=${sha256Strings(expectedKeys)} actual_digest=${sha256Strings(actualKeys)}`,
			);
		}
		await inBatches(expected, 8, async (expectedObject) => {
			const object = await proxy.env.ASSETS.get(expectedObject.r2Key);
			if (!object) throw new Error(`${target} R2 object is missing`);
			const body = await object.arrayBuffer();
			if (
				body.byteLength !== expectedObject.size ||
				sha256Bytes(body) !== expectedObject.sha256 ||
				object.httpMetadata?.contentType !== expectedObject.contentType
			) {
				throw new Error(`${target} R2 object failed byte verification`);
			}
		});

		const [userRows, projectRows] = await Promise.all([
			proxy.env.DB.prepare(
				"SELECT image FROM user WHERE image IS NOT NULL",
			).all<{ image: string }>(),
			proxy.env.DB.prepare(
				"SELECT thumbnail FROM project WHERE thumbnail IS NOT NULL",
			).all<{ thumbnail: string }>(),
		]);
		const databaseReferences = collectOwnedMediaReferences(
			userRows.results,
			projectRows.results,
		);
		const manifestReferences = new Set(
			expected.map(({ sourceUrl }) => sourceUrl),
		);
		if (
			databaseReferences.size !== manifestReferences.size ||
			[...databaseReferences.keys()].some(
				(sourceUrl) => !manifestReferences.has(sourceUrl),
			)
		) {
			throw new Error("D1 media URL mapping is incomplete");
		}
	} finally {
		await proxy.dispose();
	}
	console.log(
		`${target} R2 verify ok objects=${expected.length} missingMappings=0`,
	);
}

if (mode === "archive") await archiveMedia();
if (mode === "import-local") await importMedia("local");
if (mode === "import-remote") await importMedia("remote");
if (mode === "verify-local") await verifyMedia("local");
if (mode === "verify-remote") await verifyMedia("remote");
