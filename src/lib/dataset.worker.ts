import { normalizeArchiveDataset, type DatasetInput } from "./dataset";

self.onmessage = (message: MessageEvent<DatasetInput>) => {
	try { self.postMessage({ dataset: normalizeArchiveDataset(message.data) }); }
	catch { self.postMessage({ error: "The local dataset could not be normalized. The original ZIP files are unchanged." }); }
};
