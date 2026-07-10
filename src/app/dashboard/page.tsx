"use client";

import DialogueTabs from "@/app/dashboard/components/dialogue-tabs";
import { LlmForm } from "@/app/dashboard/components/llm-form";
import ResultDisplay from "@/app/dashboard/components/result-display";
import { useDialogueStore } from "@/app/dashboard/hooks";
import {
	ModelCatalogProvider,
	useModelCatalog,
} from "@/features/dashboard/model-catalog";
import { authClient } from "@/lib/auth-client";
import type { ModelList } from "@/types/model";
import { useEffect, useMemo } from "react";

export default function Dashboard() {
	return (
		<ModelCatalogProvider>
			<DashboardContent />
		</ModelCatalogProvider>
	);
}

function DashboardContent() {
	const { data: session } = authClient.useSession();
	const { catalog, selectedModelId } = useModelCatalog();
	const setGlobalModel = useDialogueStore((state) => state.setGlobalModel);
	const modelList = useMemo<ModelList>(
		() => ({
			aihubmix: (catalog?.models ?? []).map((model) => ({
				name: model.name,
				id: model.id,
				price: model.price,
				canOutputStructuredData: true,
			})),
		}),
		[catalog],
	);

	useEffect(() => {
		if (selectedModelId) setGlobalModel("aihubmix", selectedModelId);
	}, [selectedModelId, setGlobalModel]);

	return (
		<div className="container mx-auto flex flex-col gap-6 p-4">
			<DialogueTabs />
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="space-y-4">
					<LlmForm session={session} modelList={modelList} />
				</div>
				<ResultDisplay modelList={modelList} />
			</div>
		</div>
	);
}
