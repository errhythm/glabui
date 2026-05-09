import { mergeRequestQueueLabels, mergeRequestQueueModes, type MergeRequestQueueMode, type MergeRequestUserQueueMode } from "./domain.js"

export type PullRequestView =
	| { readonly _tag: "Repository"; readonly repository: string }
	| { readonly _tag: "Queue"; readonly mode: MergeRequestUserQueueMode; readonly repository: string | null }

export const initialPullRequestView = (): PullRequestView => ({ _tag: "Queue", mode: "authored", repository: null })

export const viewMode = (view: PullRequestView): MergeRequestQueueMode => (view._tag === "Repository" ? "repository" : view.mode)

export const viewRepository = (view: PullRequestView) => view.repository

export const viewCacheKey = (view: PullRequestView) => (view._tag === "Repository" ? `repository:${view.repository}` : view.mode)

export const viewEquals = (left: PullRequestView, right: PullRequestView) => left._tag === right._tag && viewMode(left) === viewMode(right) && left.repository === right.repository

export const activePullRequestViews = (view: PullRequestView): readonly PullRequestView[] => {
	const repository = viewRepository(view)
	return [...(repository ? [{ _tag: "Repository" as const, repository }] : []), ...mergeRequestQueueModes.map((mode) => ({ _tag: "Queue" as const, mode, repository }))]
}

export const nextView = (view: PullRequestView, views: readonly PullRequestView[], delta: 1 | -1) => {
	const index = Math.max(
		0,
		views.findIndex((candidate) => viewEquals(candidate, view)),
	)
	return views[(index + delta + views.length) % views.length]!
}

export const viewLabel = (view: PullRequestView) => (view._tag === "Repository" ? view.repository : mergeRequestQueueLabels[view.mode])

export const parseRepositoryInput = (input: string) => {
	const trimmed = input.trim()
	// Support gitlab.com URLs: https://gitlab.com/owner/repo
	const urlMatch = trimmed.match(/^(?:https?:\/\/)?(?:[^/\s]+\.)?gitlab\.[^/\s]+\/([^/\s]+(?:\/[^/\s]+)*)(?:\/-\/.*)?$/i)
	// Support namespace/project or group/subgroup/project
	const shorthandMatch = trimmed.match(/^([^/\s][^/\s]*(?:\/[^/\s]+)+)$/)
	const match = urlMatch ?? shorthandMatch
	if (!match) return null
	const path = match[1]!.replace(/\.git$/i, "").replace(/\/-\/.*$/, "")
	// Validate path components
	const parts = path.split("/")
	if (parts.length < 2) return null
	if (!parts.every((p) => /^[A-Za-z0-9_.-]+$/.test(p))) return null
	return path
}
