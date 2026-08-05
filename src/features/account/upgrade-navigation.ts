export function showUpgradeDialog<T extends object>(search: T) {
	return { ...search, settings: undefined, upgrade: true as const };
}
