// Ключи localStorage, в которых жили голоса, отметки и реакции до API. Значения не переносим —
// просто убираем мусор из браузеров, где они остались. Удалить файл через пару релизов.
const LEGACY_PREFIXES = ['nexus.review-votes.', 'nexus.marks.', 'nexus.reaction.'];

export function dropLegacyStorage(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>): void {
	const stale: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key && LEGACY_PREFIXES.some((p) => key.startsWith(p))) stale.push(key);
	}
	for (const key of stale) storage.removeItem(key);
}
