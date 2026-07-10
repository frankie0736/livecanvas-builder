"use client";

import type { AihubmixModelCatalog } from "@/lib/aihubmix";
import { useApiKeyStore } from "@/store/use-apikey-store";
import {
	type PropsWithChildren,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { resolveSelectedModelId } from "./catalog-state";

type CatalogContextValue = {
	catalog: AihubmixModelCatalog | null;
	selectedModelId: string | null;
	setSelectedModelId: (modelId: string) => void;
	isLoading: boolean;
	error: string | null;
	hasApiKey: boolean;
	refresh: () => Promise<void>;
};

const ModelCatalogContext = createContext<CatalogContextValue | null>(null);

export async function fetchCatalogFromApi(
	apiKey: string,
	fetcher: typeof fetch = fetch,
) {
	const response = await fetcher("/api/models/aihubmix", {
		headers: { Authorization: `Bearer ${apiKey.trim()}` },
		cache: "no-store",
	});
	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new Error(payload.error ?? "Failed to load AIHubMix models");
	}
	return (await response.json()) as AihubmixModelCatalog;
}

export function ModelCatalogProvider({ children }: PropsWithChildren) {
	const apiKey = useApiKeyStore((state) => state.apiKey);
	const [catalog, setCatalog] = useState<AihubmixModelCatalog | null>(null);
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasApiKey = apiKey.trim().length > 0;

	const refresh = useCallback(async () => {
		if (!hasApiKey) {
			setCatalog(null);
			setSelectedModelId(null);
			setError(null);
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		try {
			const nextCatalog = await fetchCatalogFromApi(apiKey);
			setCatalog(nextCatalog);
			setSelectedModelId((current) =>
				resolveSelectedModelId(current, nextCatalog),
			);
			setError(null);
		} catch (error) {
			setCatalog(null);
			setError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsLoading(false);
		}
	}, [apiKey, hasApiKey]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const value = useMemo(
		() => ({
			catalog,
			selectedModelId,
			setSelectedModelId,
			isLoading,
			error,
			hasApiKey,
			refresh,
		}),
		[catalog, selectedModelId, isLoading, error, hasApiKey, refresh],
	);

	return (
		<ModelCatalogContext.Provider value={value}>
			{children}
		</ModelCatalogContext.Provider>
	);
}

export function useModelCatalog() {
	const context = useContext(ModelCatalogContext);
	if (!context) {
		throw new Error("useModelCatalog must be used within ModelCatalogProvider");
	}
	return context;
}
