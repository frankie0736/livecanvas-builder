import { verifyHttpBoundaries } from "./verify-http";

await verifyHttpBoundaries({
	baseUrl:
		process.env.STAGING_BASE_URL ??
		"https://livecanvas-builder-staging.frankiexu32.workers.dev",
	event: "staging_verification_complete",
});
