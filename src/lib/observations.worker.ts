import {
	computeObservations,
	type ObservationDataset,
	type ObservationEvent,
	type ObservationAsset,
} from "./observations";
self.onmessage = (
	message: MessageEvent<{
		dataset: ObservationDataset;
		events: ObservationEvent[];
		assets: ObservationAsset[];
	}>,
) => {
	try {
		self.postMessage({
			result: computeObservations(
				message.data.dataset,
				message.data.events,
				message.data.assets,
			),
		});
	} catch {
		self.postMessage({
			error:
				"The local observations could not be calculated. Try a smaller collection.",
		});
	}
};
