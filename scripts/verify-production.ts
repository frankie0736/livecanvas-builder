import { verifyHttpBoundaries } from "./verify-http";

const baseUrl = process.env.PRODUCTION_BASE_URL;
if (!baseUrl) throw new Error("PRODUCTION_BASE_URL is required");

await verifyHttpBoundaries({
	baseUrl,
	event: "production_verification_complete",
});
