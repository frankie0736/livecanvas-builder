const mediaExtensions: Record<string, string> = {
	"image/avif": "avif",
	"image/gif": "gif",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/svg+xml": "svg",
	"image/webp": "webp",
};

const extensionMediaTypes: Record<string, string> = Object.fromEntries(
	Object.entries(mediaExtensions).map(([type, extension]) => [extension, type]),
);
extensionMediaTypes.jpeg = "image/jpeg";

export type OwnedMediaSource = "bunny" | "vercel";

export interface ArchivedMediaObject {
	source: OwnedMediaSource;
	sourceUrl: string;
	sourcePath: string;
	archivePath: string;
	r2Key: string;
	contentType: string;
	size: number;
	sha256: string;
	referenced: boolean;
}

export interface MediaManifest {
	version: 1;
	createdAt: string;
	updatedAt: string;
	complete: boolean;
	inventory: {
		vercel: number;
		bunny: number;
		referencedVercel: number;
		referencedBunny: number;
	};
	objects: ArchivedMediaObject[];
}

export function canonicalMediaUrl(value: string) {
	const url = new URL(value);
	url.hash = "";
	url.search = "";
	return url.toString();
}

export function ownedMediaSource(value: string): OwnedMediaSource | null {
	const hostname = new URL(value).hostname.toLowerCase();
	if (hostname.endsWith(".public.blob.vercel-storage.com")) return "vercel";
	if (hostname.endsWith(".b-cdn.net")) return "bunny";
	return null;
}

function normalizedObjectPath(value: string) {
	const segments = value
		.split("/")
		.filter(Boolean)
		.map((segment) => decodeURIComponent(segment));
	if (
		segments.length === 0 ||
		segments.some(
			(segment) =>
				segment === "." ||
				segment === ".." ||
				segment.includes("\\") ||
				[...segment].some((character) => character.charCodeAt(0) < 32),
		)
	) {
		throw new Error("media source has an invalid object path");
	}
	return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

export function legacyR2Key(sourceUrl: string, sourcePath?: string) {
	const source = ownedMediaSource(sourceUrl);
	if (!source) throw new Error("media URL is not owned by this application");
	const url = new URL(sourceUrl);
	const path = normalizedObjectPath(sourcePath ?? url.pathname);
	return source === "vercel"
		? `legacy/vercel/${path}`
		: `legacy/bunny/${url.hostname.toLowerCase()}/${path}`;
}

export function inferMediaType(path: string, header?: string | null) {
	const normalizedHeader = header?.split(";", 1)[0]?.trim().toLowerCase();
	if (normalizedHeader?.startsWith("image/")) return normalizedHeader;
	const extension = path.split(".").pop()?.toLowerCase() ?? "";
	return extensionMediaTypes[extension] ?? "application/octet-stream";
}

export function mediaExtension(contentType: string) {
	const extension = mediaExtensions[contentType.toLowerCase()];
	if (!extension) throw new Error("unsupported media content type");
	return extension;
}

export function createMediaKey(input: {
	kind: "avatar" | "thumbnail";
	userId: string;
	projectId?: string;
	objectId: string;
	contentType: string;
}) {
	const extension = mediaExtension(input.contentType);
	const userId = encodeURIComponent(input.userId);
	const objectId = encodeURIComponent(input.objectId);
	if (input.kind === "avatar") {
		return `avatars/${userId}/${objectId}.${extension}`;
	}
	if (!input.projectId) throw new Error("thumbnail media requires projectId");
	return `thumbnails/${userId}/project_${encodeURIComponent(input.projectId)}/${objectId}.${extension}`;
}

export function collectOwnedMediaReferences(
	users: Array<{ image?: unknown }>,
	projects: Array<{ thumbnail?: unknown }>,
) {
	const references = new Map<string, OwnedMediaSource>();
	for (const value of [
		...users.map(({ image }) => image),
		...projects.map(({ thumbnail }) => thumbnail),
	]) {
		if (typeof value !== "string" || value.length === 0) continue;
		const source = ownedMediaSource(value);
		if (source) references.set(canonicalMediaUrl(value), source);
	}
	return references;
}

export function publicMediaUrl(baseUrl: string, key: string) {
	const encodedKey = key
		.split("/")
		.map((segment) => encodeURIComponent(decodeURIComponent(segment)))
		.join("/");
	if (baseUrl.startsWith("/")) {
		return `${baseUrl.replace(/\/$/, "")}/${encodedKey}`;
	}
	const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
	return new URL(encodedKey, base).toString();
}
