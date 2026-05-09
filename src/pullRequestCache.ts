import type { MergeRequestItem } from "./domain.js"

export const mergeCachedDetails = (fresh: readonly MergeRequestItem[], cached: readonly MergeRequestItem[] | undefined) => {
	if (!cached) return fresh
	const cachedByUrl = new Map(cached.map((mr) => [mr.url, mr]))
	return fresh.map((mr) => {
		const cachedMr = cachedByUrl.get(mr.url)
		if (!cachedMr?.detailLoaded || cachedMr.headRefOid !== mr.headRefOid) return mr
		return {
			...mr,
			body: cachedMr.body,
			labels: cachedMr.labels,
			additions: cachedMr.additions,
			deletions: cachedMr.deletions,
			changedFiles: cachedMr.changedFiles,
			detailLoaded: true,
		} satisfies MergeRequestItem
	})
}
