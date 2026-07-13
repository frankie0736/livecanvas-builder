import { verifyHttpBoundaries } from "./verify-http";

await verifyHttpBoundaries({
	baseUrl: process.env.BASE_URL ?? "http://127.0.0.1:5173",
	event: "local_verification_complete",
});
