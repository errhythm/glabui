import type { MergeRequestItem } from "./domain.js"

export const mergeCachedDetails = (fresh: readonly MergeRequestItem[], cached: readonly MergeRequestItem[] | undefined) => {
	if (!cached) return fresh
	const cachedByUrl = new Map(cached.map((mr) => [mr.url, mr]))
	return fresh.map((mr) => {
		const cachedMr = cachedByUrl.get(mr.url)
		if (!cachedMr?.detailLoaded || cachedMr.headRefOid !== mr.headRefOid) return mr
		return {
			...mr,
			body: cachedMr.body.length > 0 ? cachedMr.body : mr.body,
			labels: (cachedMr.labels ?? []).length > 0 ? cachedMr.labels : mr.labels,
			assignees: (cachedMr.assignees ?? []).length > 0 ? cachedMr.assignees : mr.assignees,
			reviewers: (cachedMr.reviewers ?? []).length > 0 ? cachedMr.reviewers : mr.reviewers,
			milestone: cachedMr.milestone ?? mr.milestone,
			commentCount: cachedMr.commentCount ?? mr.commentCount,
			upvotes: cachedMr.upvotes ?? mr.upvotes,
			downvotes: cachedMr.downvotes ?? mr.downvotes,
			blockingDiscussionsResolved: cachedMr.blockingDiscussionsResolved ?? mr.blockingDiscussionsResolved,
			references: cachedMr.references ?? mr.references,
			targetBranch: cachedMr.targetBranch || mr.targetBranch,
			approvalRules: (cachedMr.approvalRules ?? []).length > 0 ? cachedMr.approvalRules : mr.approvalRules,
			additions: cachedMr.additions,
			deletions: cachedMr.deletions,
			changedFiles: cachedMr.changedFiles,
			projectUrl: cachedMr.projectUrl ?? mr.projectUrl,
			detailLoaded: true,
		} satisfies MergeRequestItem
	})
}
