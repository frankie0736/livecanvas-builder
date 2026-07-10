export type AvailableProviderId = "aihubmix";

export type AvailableModelName = string;

export type AvailableModelId = string;

export interface Model {
	name: AvailableModelName;
	id: AvailableModelId;
	price: {
		input: number;
		output: number;
	};
	canOutputStructuredData: boolean;
}

export type ModelList = Record<AvailableProviderId, Model[]>;
