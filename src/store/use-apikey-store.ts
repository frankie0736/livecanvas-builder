import { create } from "zustand";
import {
	type StateStorage,
	createJSONStorage,
	persist,
} from "zustand/middleware";

interface ApiKeyStore {
	apiKey: string;
	setApiKey: (apiKey: string) => void;
}

const browserStorage: StateStorage = {
	getItem: (name) =>
		typeof window === "undefined" ? null : window.localStorage.getItem(name),
	setItem: (name, value) => {
		if (typeof window !== "undefined") window.localStorage.setItem(name, value);
	},
	removeItem: (name) => {
		if (typeof window !== "undefined") window.localStorage.removeItem(name);
	},
};

export const useApiKeyStore = create<ApiKeyStore>()(
	persist(
		(set) => ({
			apiKey: "",
			setApiKey: (apiKey) => set({ apiKey }),
		}),
		{
			name: "aihubmix_api_key",
			storage: createJSONStorage(() => browserStorage),
		},
	),
);
