import { Effect, Layer } from "effect"
import type { CheckItem, CreatePullRequestCommentInput, Mergeable, PullRequestItem, PullRequestLabel, PullRequestMergeInfo, PullRequestQueueMode, PullRequestReviewComment, ReviewStatus } from "../domain.js"
import { GitHubService } from "./GitHubService.js"

export interface MockOptions {
	readonly prCount: number
	readonly repoCount?: number
	readonly username?: string
	readonly seed?: number
}

const REVIEW_CYCLE: readonly ReviewStatus[] = ["approved", "changes", "review", "none", "draft"]
const MERGEABLE_CYCLE: readonly Mergeable[] = ["mergeable", "conflicting", "unknown"]

const synthCheckSummary = (passed: number, total: number): Pick<PullRequestItem, "checkStatus" | "checkSummary" | "checks"> => {
	const checks: readonly CheckItem[] = Array.from({ length: total }, (_, index) => ({
		name: `check-${index}`,
		status: "completed",
		conclusion: index < passed ? "success" : "failure",
	}))
	if (total === 0) return { checkStatus: "none", checkSummary: null, checks: [] }
	if (passed === total) return { checkStatus: "passing", checkSummary: `${passed}/${total}`, checks }
	return { checkStatus: "failing", checkSummary: `${passed}/${total}`, checks }
}

const synthLabels = (index: number): readonly PullRequestLabel[] => {
	if (index % 5 === 0) return [{ name: "bug", color: "#d73a4a" }]
	if (index % 7 === 0) return [{ name: "enhancement", color: "#a2eeef" }, { name: "tests", color: "#0e8a16" }]
	return []
}

const buildPullRequest = (index: number, options: Required<MockOptions>): PullRequestItem => {
	const repoIndex = index % options.repoCount
	const repository = `mock-org/repo-${repoIndex}`
	const number = 1000 + index
	const total = 8 + (index % 5)
	const passed = total - (index % 3 === 0 ? 1 : 0)
	const review = REVIEW_CYCLE[index % REVIEW_CYCLE.length]!
	const createdAt = new Date(Date.now() - index * 86_400_000)

	return {
		repository,
		author: options.username,
		headRefOid: `deadbeef${index.toString(16).padStart(8, "0")}`,
		number,
		title: `Mock PR ${number}: example change ${index}`,
		body: `This is mock pull request #${number}.\n\nLine A.\nLine B.`,
		labels: synthLabels(index),
		additions: 10 + index,
		deletions: 5 + (index % 11),
		changedFiles: 1 + (index % 7),
		state: "open",
		reviewStatus: review,
		...synthCheckSummary(passed, total),
		autoMergeEnabled: index % 11 === 0,
		detailLoaded: true,
		createdAt,
		closedAt: null,
		url: `https://github.com/${repository}/pull/${number}`,
	}
}

export const buildMockPullRequests = (options: MockOptions): readonly PullRequestItem[] => {
	const resolved: Required<MockOptions> = {
		prCount: options.prCount,
		repoCount: options.repoCount ?? 4,
		username: options.username ?? "mock-user",
		seed: options.seed ?? 0,
	}
	return Array.from({ length: resolved.prCount }, (_, index) => buildPullRequest(index, resolved))
}

export const MockGitHubService = {
	layer: (options: MockOptions) => {
		const items = buildMockPullRequests(options)
		const username = options.username ?? "mock-user"
		const summaryItems = items.map((item) => ({
			...item,
			body: "",
			labels: [],
			additions: 0,
			deletions: 0,
			changedFiles: 0,
			detailLoaded: false,
		} satisfies PullRequestItem))
		const filterByView = (mode: PullRequestQueueMode, repository: string | null, source: readonly PullRequestItem[]) => {
			if (mode === "repository") return repository ? source.filter((item) => item.repository === repository) : []
			return source
		}
		const findPullRequest = (repository: string, number: number) => items.find((item) => item.repository === repository && item.number === number) ?? items[0]!

		return Layer.succeed(
			GitHubService,
			GitHubService.of({
				listOpenPullRequests: (mode: PullRequestQueueMode, repository: string | null) => Effect.succeed(filterByView(mode, repository, summaryItems)),
				listOpenPullRequestDetails: (mode: PullRequestQueueMode, repository: string | null) => Effect.succeed(filterByView(mode, repository, items)),
				getPullRequestDetails: (repository, number) => Effect.succeed(findPullRequest(repository, number)),
				getAuthenticatedUser: () => Effect.succeed(username),
				getPullRequestDiff: (_repo, _number) => Effect.succeed(""),
				listPullRequestComments: (_repo, _number) => Effect.succeed([] as readonly PullRequestReviewComment[]),
				getPullRequestMergeInfo: (repository, number) => Effect.succeed({
					repository,
					number,
					title: `Mock PR ${number}`,
					state: "open",
					isDraft: false,
					mergeable: MERGEABLE_CYCLE[number % MERGEABLE_CYCLE.length]!,
					reviewStatus: "approved",
					checkStatus: "passing",
					checkSummary: "10/10",
					autoMergeEnabled: false,
				} satisfies PullRequestMergeInfo),
				mergePullRequest: () => Effect.void,
				closePullRequest: () => Effect.void,
				createPullRequestComment: (input: CreatePullRequestCommentInput) => Effect.succeed({
					id: `mock:${Date.now()}`,
					path: input.path,
					line: input.line,
					side: input.side,
					author: username,
					body: input.body,
					createdAt: new Date(),
					url: null,
				} satisfies PullRequestReviewComment),
				toggleDraftStatus: () => Effect.void,
				listRepoLabels: () => Effect.succeed([]),
				addPullRequestLabel: () => Effect.void,
				removePullRequestLabel: () => Effect.void,
			}),
		)
	},
}
