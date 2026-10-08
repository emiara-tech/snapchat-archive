import type {
	ArchiveDataset,
	ConversationEvent,
	MediaAsset,
} from "../types/dataset";
import {
	computeObservations,
	type LocalObservations,
	type ObservationDataset,
	type ObservationEvent,
	type ObservationAsset,
} from "./observations";

export function observationJob(
	dataset: ArchiveDataset,
	events: ConversationEvent[],
	assets: MediaAsset[],
	signal: AbortSignal,
): Promise<LocalObservations> {
	if (signal.aborted)
		return Promise.reject(new DOMException("Cancelled", "AbortError"));
	const input: {
		dataset: ObservationDataset;
		events: ObservationEvent[];
		assets: ObservationAsset[];
	} = {
		dataset: {
			revision: dataset.revision,
			timezone: dataset.timezone,
			participants: dataset.participants.map((person) => ({
				...person,
				sources: [],
			})),
			conversations: dataset.conversations.map((conversation) => ({
				...conversation,
				eventIds: [],
				sources: [],
			})),
		},
		events: events.map(
			({
				id,
				conversationId,
				timestamp,
				assetIds,
				ownerAuthored,
				authorship,
				kind,
				text,
			}) => ({
				id,
				conversationId,
				timestamp,
				assetIds,
				ownerAuthored,
				authorship,
				kind,
				text,
			}),
		),
		assets: assets.map(({ id, timestamp, kind, available, location, role }) => ({
			id,
			timestamp,
			kind,
			available,
			location,
			role,
		})),
	};
	if (typeof Worker === "undefined") {
		if (events.length + assets.length > 5000)
			return Promise.reject(
				new Error(
					"This browser cannot run background calculations. Choose a smaller collection or use a browser with worker support.",
				),
			);
		return Promise.resolve(
			computeObservations(input.dataset, input.events, input.assets),
		);
	}
	return new Promise((resolve, reject) => {
		const worker = new Worker(
			new URL("./observations.worker.ts", import.meta.url),
			{ type: "module" },
		);
		const close = () => {
			worker.terminate();
			signal.removeEventListener("abort", abort);
		};
		const abort = () => {
			close();
			reject(new DOMException("Cancelled", "AbortError"));
		};
		signal.addEventListener("abort", abort, { once: true });
		worker.onmessage = (
			message: MessageEvent<{ result?: LocalObservations; error?: string }>,
		) => {
			close();
			if (message.data.result) resolve(message.data.result);
			else
				reject(new Error(message.data.error ?? "Local calculations failed."));
		};
		worker.onerror = () => {
			close();
			reject(new Error("Local calculations failed. Try a smaller collection."));
		};
		worker.postMessage(input);
	});
}
