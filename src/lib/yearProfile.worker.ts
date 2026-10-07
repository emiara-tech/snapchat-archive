import { buildYearProfile } from "./yearProfile";
import type { ProfileJobInput } from "./yearProfileJob";
self.onmessage = (message: MessageEvent<ProfileJobInput>) => {
	const { jobId, dataset, events, year, timezone, options, preparation } = message.data;
	try {
		const profile = buildYearProfile(dataset, events, year, timezone, { ...options,
			progress: (fraction, stage) => self.postMessage({ jobId, progress: { fraction, stage } }) }, preparation);
		self.postMessage({ jobId, profile });
	} catch { self.postMessage({ jobId, error: "The local year profile could not be calculated. Original messages are unchanged." }); }
};
