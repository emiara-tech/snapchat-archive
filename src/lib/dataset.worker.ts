import { normalizeArchiveDataset, type DatasetInput } from "./dataset";
import { OccurrencePreparationError, knownOccurrenceError } from "./datasetOccurrenceFacts";

self.onmessage = (message: MessageEvent<DatasetInput>) => {
	try { self.postMessage({ dataset: normalizeArchiveDataset(message.data) }); }
	catch (error) {
		const known = error instanceof OccurrencePreparationError ? knownOccurrenceError(error.message) : null;
		self.postMessage({ error: known?.message ?? "The local dataset could not be normalized. The original ZIP files are unchanged." });
	}
};
