import type { ArchiveMetadata } from "../../types";
import type { SnapchatArchiveReader } from "../snapArchive";

export interface AnalyzerContext {
	reader: SnapchatArchiveReader;
	metadata: ArchiveMetadata;
}

export interface DataAnalyzer<T = unknown> {
	id: string;
	title: string;
	description?: string;
	run(context: AnalyzerContext): Promise<T>;
}

export type AnalyzerResultMap = Map<string, unknown>;