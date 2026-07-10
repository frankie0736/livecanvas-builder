export function resolveNeonSnapshotUrl(databaseUrl: string) {
	const url = new URL(databaseUrl);
	if (
		!(["postgres:", "postgresql:"] as string[]).includes(url.protocol) ||
		!url.hostname.endsWith(".neon.tech")
	) {
		throw new Error("snapshot source must be a Neon PostgreSQL URL");
	}

	url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
	// Remove these overrides when the local libpq path supports channel binding.
	url.searchParams.set("channel_binding", "disable");
	url.searchParams.set("sslmode", "require");
	return url.toString();
}
