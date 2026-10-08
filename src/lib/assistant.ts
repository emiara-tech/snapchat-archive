import type {
	ArchiveDataset,
	ArchiveQuery,
	ReviewStatus,
} from "../types/dataset";

export interface LocalRequestPlan {
	kind: "query" | "review" | "explain";
	query: ArchiveQuery;
	status?: ReviewStatus;
	title: string;
	description: string;
}

export function planLocalRequest(
	input: string,
	dataset: ArchiveDataset,
	current: ArchiveQuery,
): LocalRequestPlan | { error: string } {
	const text = input.trim();
	if (!text || text.length > 2000)
		return { error: "Write a supported request of at most 2,000 characters." };
	const literals = [...text.matchAll(/["“]([^"”]{1,200})["”]/g)];
	if (literals.length > 1)
		return { error: "Choose one literal search phrase for this preview." };
	let command = text.replace(/["“][^"”]{1,200}["”]/g, " ").toLocaleLowerCase();
	if (/["“”]/.test(command))
		return { error: "Close the quotation marks around one search phrase." };
	if (
		/\b(export|transfer|upload|send|delete|erase|pay|connect|password|fetch|execute|script)\b/.test(
			command,
		)
	)
		return {
			error:
				"Use the direct export, destination, account, or review controls for this action. This local guide cannot authorize transfers, payments, deletion, or code execution.",
		};
	if (
		/\b(except|unless|without|not|never|but|excluding|leave out|don't|do not|or|before|after|between|compare|difference|through|until)\b/.test(
			command,
		)
	)
		return {
			error:
				"This request includes a comparison, alternative, range, or exclusion that this local grammar cannot represent. Choose one year and participant with the filter controls, then preview a simpler request.",
		};
	const query: ArchiveQuery = { ...current, review: "active" };
	const years = [...command.matchAll(/\b(\d{4})\b/g)].map((match) =>
		Number(match[1]),
	);
	if (years.length > 1 || years.some((year) => year < 1900 || year > 2200))
		return { error: "Choose one supported calendar year for this preview." };
	if (years[0] !== undefined) query.year = years[0];
	const kinds = [
		...command.matchAll(/\b(photos|images|videos|messages)\b/g),
	].map((match) =>
		match[1] === "videos"
			? "video"
			: match[1] === "messages"
				? "text"
				: "image",
	);
	if (new Set(kinds).size > 1)
		return { error: "Choose one record type for this preview." };
	if (kinds[0]) query.kind = kinds[0] as ArchiveQuery["kind"];
	const explain =
		/^(?:who did i talk with most|who did i talk to most|how many|count|why|who)\b/.test(
			command,
		);
	command = command.replace(/^who did i talk (?:with|to) most\b/, "count");
	const personPattern =
		/\bwith\s+(.+?)(?=\s+(?:from|in|during|for|containing)\b|\s+\d{4}\b|[?.!]*$)/i;
	const person = personPattern.exec(command)?.[1]?.trim();
	if (person) {
		const matches = dataset.participants.filter(
			(participant) =>
				!participant.isOwner &&
				[participant.displayName, participant.username].some(
					(value) => value?.toLocaleLowerCase() === person,
				),
		);
		if (matches.length !== 1)
			return {
				error: matches.length
					? "That name matches several participants. Choose the participant in the filter controls before continuing."
					: `No single recorded participant matches “${person}”. Choose a known participant in the filter controls.`,
			};
		query.participantId = matches[0]!.id;
		command = command.replace(personPattern, " ");
	}
	if (literals[0]) query.text = literals[0][1]!;
	let status: ReviewStatus | undefined;
	if (/^\s*(?:please\s+)?(?:keep|exclude)\b/.test(command))
		status = /\bexclude\b/.test(command) ? "exclude" : "keep";
	else if (/^\s*(?:please\s+)?mark\b/.test(command)) {
		status = /\bfor later\b/.test(command)
			? "later"
			: /\bas keep\b/.test(command)
				? "keep"
				: /\bas excluded?\b/.test(command)
					? "exclude"
					: undefined;
		if (!status)
			return {
				error:
					"Say ‘Mark videos from 2019 for later’, ‘Keep photos’, or ‘Exclude messages’ to preview a review decision.",
			};
	}
	if (
		!status &&
		!explain &&
		!/^\s*(?:please\s+)?(?:show|find|prepare)\b/.test(command)
	)
		return {
			error:
				"Try ‘Show photos from 2019’, ‘Find messages with Jamie’, or ‘Mark videos from 2019 for later’. This guide uses a small local grammar.",
		};
	const remainder = command
		.replace(/\b(?:from|in|during)\s+\d{4}\b/g, " ")
		.replace(/\b\d{4}\b/g, " ")
		.replace(
			/\b(?:who did i talk with most|who did i talk to most|how many|for later|as keep|as excluded?)\b/g,
			" ",
		)
		.replace(
			/\b(?:please|show|find|prepare|keep|exclude|mark|who|count|why|photos|images|videos|messages|conversations|containing|my|all|the|recorded|me)\b/g,
			" ",
		)
		.replace(/[?.!,\s]+/g, "");
	if (remainder)
		return {
			error:
				"Part of this request is outside the supported local grammar. Use the filters for the exact scope or simplify the request before applying.",
		};
	return {
		kind: status ? "review" : explain ? "explain" : "query",
		query,
		status,
		title: status
			? `Preview marking matches ${status === "later" ? "for later" : status}`
			: explain
				? "Your selected collection, explained"
				: "Preview your local selection",
		description:
			"The preview uses the displayed year, participant, type, and literal text. Existing filters are preserved where the request does not change them. Excluded records stay excluded; inspect the exact matches before applying.",
	};
}
