import { createFileRoute } from "@tanstack/react-router";

import {
	AihubmixModelCatalogError,
	fetchAihubmixModelCatalog,
} from "@/lib/aihubmix";

type CatalogFetcher = Parameters<typeof fetchAihubmixModelCatalog>[1];
type ErrorLogger = (event: Record<string, unknown>) => void;

export function createAihubmixModelsHandler(
	fetcher: CatalogFetcher = fetch,
	logError: ErrorLogger = (event) => console.error(event),
) {
	return async ({ request }: { request: Request }) => {
		const authorization = request.headers.get("Authorization") ?? "";
		const apiKey = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim() ?? "";
		try {
			const catalog = await fetchAihubmixModelCatalog(apiKey, fetcher);
			return Response.json(catalog, {
				headers: { "Cache-Control": "no-store, max-age=0" },
			});
		} catch (error) {
			const status =
				error instanceof AihubmixModelCatalogError
					? (error.status ?? 500)
					: 500;
			const message =
				error instanceof AihubmixModelCatalogError
					? error.message
					: "Failed to load AIHubMix model catalog";
			logError({
				event: "aihubmix_catalog_failed",
				request_id: crypto.randomUUID(),
				status,
				error: error instanceof Error ? error.message : String(error),
			});
			return Response.json(
				{ error: message },
				{
					status,
					headers: { "Cache-Control": "no-store, max-age=0" },
				},
			);
		}
	};
}

export const Route = createFileRoute("/api/models/aihubmix")({
	server: { handlers: { GET: createAihubmixModelsHandler() } },
});
