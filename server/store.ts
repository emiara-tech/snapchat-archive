export interface DurableStore {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, seconds: number): Promise<void>;
	remove(key: string): Promise<void>;
	take(key: string, expected: string): Promise<boolean>;
	claim(key: string, value: string, seconds: number): Promise<boolean>;
	replace(
		key: string,
		expected: string,
		value: string,
		seconds: number,
	): Promise<boolean>;
}
export function redisStore(url: string, credential: string): DurableStore {
	const endpoint = new URL(url);
	if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password)
		throw new Error("Durable store requires a credential-free HTTPS origin");
	async function command(values: (string | number)[]): Promise<unknown> {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${credential}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(values),
			signal: AbortSignal.timeout(10000),
			redirect: "error",
		});
		if (!response.ok) throw new Error("Durable store unavailable");
		const result = (await response.json()) as {
			result?: unknown;
			error?: string;
		};
		if (result.error) throw new Error("Durable store operation failed");
		return result.result;
	}
	const prefix = "goodbye-chat:v1:";
	return {
		async get(key) {
			const result = await command(["GET", prefix + key]);
			return typeof result === "string" ? result : null;
		},
		async put(key, value, seconds) {
			await command([
				"SET",
				prefix + key,
				value,
				"EX",
				Math.max(1, Math.floor(seconds)),
			]);
		},
		async remove(key) {
			await command(["DEL", prefix + key]);
		},
		async take(key, expected) {
			return (
				(await command([
					"EVAL",
					"if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1]); return 1 else return 0 end",
					1,
					prefix + key,
					expected,
				])) === 1
			);
		},
		async claim(key, value, seconds) {
			return (
				(await command(["SET", prefix + key, value, "NX", "EX", seconds])) ===
				"OK"
			);
		},
		async replace(key, expected, value, seconds) {
			return (
				(await command([
					"EVAL",
					"if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1 else return 0 end",
					1,
					prefix + key,
					expected,
					value,
					seconds,
				])) === 1
			);
		},
	};
}
