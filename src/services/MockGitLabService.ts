import { Effect, Layer } from "effect"
import type {
	ApprovalRule,
	CreateMergeRequestCommentInput,
	Mergeable,
	MergeRequestComment,
	MergeRequestItem,
	MergeRequestLabel,
	MergeRequestMergeInfo,
	MergeRequestPage,
	MergeRequestQueueMode,
	PipelineJob,
	ReviewStatus,
} from "../domain.js"
import { mergeInfoFromMergeRequest } from "../mergeActions.js"
import { type GitLabDiff, GitLabService } from "./GitLabService.js"

export interface MockOptions {
	readonly prCount: number
	readonly repoCount?: number
	readonly username?: string
	readonly seed?: number
}

const REVIEW_CYCLE: readonly ReviewStatus[] = ["approved", "changes", "review", "none", "draft"]
const MERGEABLE_CYCLE: readonly Mergeable[] = ["mergeable", "conflicting", "unknown"]

const synthCheckSummary = (passed: number, total: number): Pick<MergeRequestItem, "checkStatus" | "checkSummary" | "checks"> => {
	const checks: readonly PipelineJob[] = Array.from({ length: total }, (_, index) => ({
		name: `check-${index}`,
		status: index < passed ? "success" : "failed",
		stage: "test",
	}))
	if (total === 0) return { checkStatus: "none", checkSummary: null, checks: [] }
	if (passed === total) return { checkStatus: "passing", checkSummary: `${passed}/${total}`, checks }
	return { checkStatus: "failing", checkSummary: `${passed}/${total}`, checks }
}

const synthLabels = (index: number): readonly MergeRequestLabel[] => {
	if (index % 5 === 0) return [{ name: "bug", color: "#d73a4a" }]
	if (index % 7 === 0)
		return [
			{ name: "enhancement", color: "#a2eeef" },
			{ name: "tests", color: "#0e8a16" },
		]
	return []
}

const buildMergeRequest = (index: number, options: Required<MockOptions>): MergeRequestItem => {
	const repoIndex = index % options.repoCount
	const repository = `mock-org/repo-${repoIndex}`
	const number = 1000 + index
	const total = 8 + (index % 5)
	const passed = total - (index % 3 === 0 ? 1 : 0)
	const review = REVIEW_CYCLE[index % REVIEW_CYCLE.length]!
	const isDraft = review === "draft"
	const createdAt = new Date(Date.now() - index * 86_400_000)

	return {
		repository,
		author: options.username,
		headRefOid: `deadbeef${index.toString(16).padStart(8, "0")}`,
		headRefName: `mock-branch-${index}`,
		targetBranch: "main",
		references: `${repository}!${number}`,
		number,
		title: `Mock PR ${number}: example change ${index}`,
		body: `This is mock merge request !${number}.\n\nLine A.\nLine B.`,
		labels: synthLabels(index),
		assignees: index % 3 === 0 ? ["mock-assignee"] : [],
		reviewers: index % 4 === 0 ? ["mock-reviewer"] : [],
		milestone: index % 8 === 0 ? { title: "Release train", dueDate: new Date(Date.now() + 7 * 86_400_000), webUrl: `https://gitlab.com/${repository}/-/milestones/1` } : null,
		commentCount: index % 9,
		upvotes: index % 5,
		downvotes: index % 2,
		blockingDiscussionsResolved: index % 2 === 0,
		additions: 10 + index,
		deletions: 5 + (index % 11),
		changedFiles: 1 + (index % 7),
		state: "open",
		isDraft,
		reviewStatus: review,
		...synthCheckSummary(passed, total),
		approvalRules: index % 6 === 0 ? [{ name: "Staging Approvals", approvalsRequired: 1, approvedBy: [], approved: false } satisfies ApprovalRule] : [],
		autoMergeEnabled: index % 11 === 0,
		detailLoaded: true,
		createdAt,
		closedAt: null,
		url: `https://gitlab.com/${repository}/-/merge_requests/${number}`,
		projectUrl: `https://gitlab.com/${repository}`,
	}
}

export const buildMockMergeRequests = (options: MockOptions): readonly MergeRequestItem[] => {
	const resolved: Required<MockOptions> = {
		prCount: options.prCount,
		repoCount: options.repoCount ?? 4,
		username: options.username ?? "mock-user",
		seed: options.seed ?? 0,
	}
	return Array.from({ length: resolved.prCount }, (_, index) => buildMergeRequest(index, resolved))
}

const filterByView = (mode: MergeRequestQueueMode, repository: string | null, source: readonly MergeRequestItem[]) => {
	if (mode === "repository") return repository ? source.filter((item) => item.repository === repository) : []
	return source
}

const pageItems = (source: readonly MergeRequestItem[], cursor: string | null, pageSize: number): MergeRequestPage => {
	const start = cursor ? Number.parseInt(cursor, 10) : 0
	const safeStart = Number.isFinite(start) && start >= 0 ? start : 0
	const safePageSize = Math.max(1, Math.min(100, pageSize))
	const end = Math.min(source.length, safeStart + safePageSize)
	return {
		items: source.slice(safeStart, end),
		endCursor: end > safeStart ? String(end) : null,
		hasNextPage: end < source.length,
	}
}

const mockDiff: readonly GitLabDiff[] = [
	{
		filename: "src/mockDiff.ts",
		previousFilename: null,
		status: "modified",
		patch: `diff --git a/src/mockDiff.ts b/src/mockDiff.ts\n--- a/src/mockDiff.ts\n+++ b/src/mockDiff.ts\n@@ -1,6 +1,6 @@\n export const before = true\n-const oldOne = 1\n+const newOne = 1\n-  sameName()\n+\tsameName()\n-const oldTwo = 2\n+const newTwo = 2\n export const after = true`,
	},
]

export const MockGitLabService = {
	layer: (options: MockOptions) => {
		const items = buildMockMergeRequests(options)
		const username = options.username ?? "mock-user"
		const summaryItems = items.map(
			(item) =>
				({
					...item,
					body: "",
					labels: [],
					checks: [],
					detailLoaded: false,
				}) satisfies MergeRequestItem,
		)

		const findMR = (repository: string, number: number) => items.find((item) => item.repository === repository && item.number === number) ?? items[0]!

		const discussionComments = (repository: string, number: number): readonly MergeRequestComment[] => {
			const mr = findMR(repository, number)
			return [
				{
					_tag: "comment" as const,
					id: `mock-note-${mr.number}`,
					author: username,
					body: `Mock issue comment on !${mr.number}`,
					createdAt: mr.createdAt,
					url: null,
				},
				{
					_tag: "review-comment" as const,
					id: `mock-review-${mr.number}`,
					path: "src/App.tsx",
					line: 42,
					side: "RIGHT" as const,
					author: username,
					body: `Mock inline comment on !${mr.number}`,
					createdAt: mr.createdAt,
					url: null,
					inReplyTo: null,
				},
			]
		}

		return Layer.succeed(
			GitLabService,
			GitLabService.of({
				getViewer: () => Effect.succeed(username),
				listMergeRequests: (input) => Effect.succeed(pageItems(filterByView(input.mode, input.repository, summaryItems), input.cursor, input.pageSize)),
				getMergeRequestDetail: (repository, number) => Effect.succeed(findMR(repository, number)),
				getMergeRequestMergeInfo: ({ repository, number }) => {
					const mr = findMR(repository, number)
					return Effect.succeed({
						...mergeInfoFromMergeRequest(mr),
						repository,
						number,
						mergeable: MERGEABLE_CYCLE[number % MERGEABLE_CYCLE.length]!,
						reviewStatus: mr.isDraft ? "approved" : mr.reviewStatus,
						checkStatus: "passing",
						checkSummary: "10/10",
					} satisfies MergeRequestMergeInfo)
				},
				getMergeRequestDiff: (_repository, _number, _commitId) => Effect.succeed(mockDiff),
				getMergeRequestComments: (repository, number) => Effect.succeed(discussionComments(repository, number)),
				createMergeRequestComment: (input: CreateMergeRequestCommentInput) =>
					Effect.succeed({
						_tag: "review-comment" as const,
						id: `mock:${Date.now()}`,
						path: input.path ?? "unknown",
						line: input.line ?? 1,
						side: (input.side ?? "RIGHT") as "LEFT" | "RIGHT",
						author: username,
						body: input.body,
						createdAt: new Date(),
						url: null,
						inReplyTo: null,
					} satisfies MergeRequestComment),
				replyToDiscussion: (_repository, _number, _discussionId, body) =>
					Effect.succeed({
						_tag: "review-comment" as const,
						id: `mock-reply:${Date.now()}`,
						path: "src/App.tsx",
						line: 42,
						side: "RIGHT" as const,
						author: username,
						body,
						createdAt: new Date(),
						url: null,
						inReplyTo: null,
					} satisfies MergeRequestComment),
				editMergeRequestComment: (_repository, _number, noteId, body) =>
					Effect.succeed({
						_tag: "comment" as const,
						id: noteId,
						author: username,
						body,
						createdAt: new Date(),
						url: null,
					} satisfies MergeRequestComment),
				deleteMergeRequestComment: () => Effect.void,
				submitMergeRequestReview: () => Effect.void,
				mergeMergeRequest: () => Effect.void,
				closeMergeRequest: () => Effect.void,
				toggleDraftStatus: () => Effect.void,
				addLabel: () => Effect.void,
				removeLabel: () => Effect.void,
				getRepositoryLabels: () => Effect.succeed([]),
				getRepositoryMergeMethods: () => Effect.succeed({ squash: true, merge: true, rebase: true }),
				openInBrowser: () => Effect.void,
				getPipelineJobs: () => Effect.succeed([]),
			}),
		)
	},
}
