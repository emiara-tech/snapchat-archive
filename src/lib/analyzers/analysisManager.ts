import type { AnalyzerContext, DataAnalyzer, AnalyzerResultMap } from "./base";

export class AnalysisManager {
	readonly analyzers = new Map<string, DataAnalyzer>();
	readonly results: AnalyzerResultMap = new Map();
	readonly context: AnalyzerContext;

	constructor(context: AnalyzerContext) {
		this.context = context;
	}

	register(analyzer: DataAnalyzer): void {
		this.analyzers.set(analyzer.id, analyzer);
	}

	registerAll(analyzers: DataAnalyzer[]): void {
		for (const analyzer of analyzers) {
			this.register(analyzer);
		}
	}

	async runOne<T>(id: string): Promise<T> {
		if (this.results.has(id)) {
			return this.results.get(id) as T;
		}

		const analyzer = this.analyzers.get(id);
		if (!analyzer) {
			throw new Error(`Analyzer not registered: ${id}`);
		}

		const result = await analyzer.run(this.context);
		this.results.set(id, result);
		return result as T;
	}

	async runAll(
		onProgress?: (completed: number, total: number, id: string) => void,
	): Promise<AnalyzerResultMap> {
		const entries = Array.from(this.analyzers.entries());
		const total = entries.length;
		let completed = 0;

		for (const [id, analyzer] of entries) {
			if (this.results.has(id)) {
				completed += 1;
				onProgress?.(completed, total, id);
				continue;
			}

			const result = await analyzer.run(this.context);
			this.results.set(id, result);
			completed += 1;
			onProgress?.(completed, total, id);
		}

		return new Map(this.results);
	}

	getCachedResults(): AnalyzerResultMap {
		return new Map(this.results);
	}
}