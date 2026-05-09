import { Schema } from "effect"

export type LoadStatus = "loading" | "ready" | "error"

export const mergeRequestStates = ["open", "closed", "merged"] as const
export type MergeRequestState = (typeof mergeRequestStates)[number]

export const mergeRequestQueueModes = ["authored", "review", "assigned", "mentioned"] as const
export type MergeRequestUserQueueMode = (typeof mergeRequestQueueModes)[number]
export type MergeRequestQueueMode = "repository" | MergeRequestUserQueueMode

export const mergeRequestQueueLabels = {
	repository: "repository",
	authored: "authored",
	review: "review requested",
	assigned: "assigned",
	mentioned: "mentioned",
} as const satisfies Record<MergeRequestQueueMode, string>

// GitLab pipeline statuses
export const pipelineStatuses = ["success", "failed", "canceled", "skipped", "running", "pending", "created", "manual", "scheduled", "preparing", "waiting_for_resource"] as const
export type PipelineStatus = (typeof pipelineStatuses)[number]

export const checkRollupStatuses = ["passing", "pending", "failing", "none"] as const
export type CheckRollupStatus = (typeof checkRollupStatuses)[number]

// GitLab approval/review status
export const reviewStatuses = ["draft", "approved", "changes", "review", "none"] as const
export type ReviewStatus = (typeof reviewStatuses)[number]

export type Mergeable = "mergeable" | "conflicting" | "unknown"

export const DiffCommentSide = Schema.Literals(["LEFT", "RIGHT"])
export type DiffCommentSide = Schema.Schema.Type<typeof DiffCommentSide>

// GitLab merge strategies
export const mergeRequestMergeMethods = ["squash", "merge", "rebase"] as const
export type MergeRequestMergeMethod = (typeof mergeRequestMergeMethods)[number]

export const mergeRequestMergeKinds = ["now", "when_pipeline_succeeds", "admin", "disable-auto"] as const
export type MergeRequestMergeKind = (typeof mergeRequestMergeKinds)[number]
export type MergeRequestMergeMethodKind = Exclude<MergeRequestMergeKind, "disable-auto">

export type MergeRequestMergeAction =
	| {
			readonly kind: MergeRequestMergeMethodKind
			readonly method: MergeRequestMergeMethod
	  }
	| {
			readonly kind: "disable-auto"
	  }

export interface RepositoryMergeMethods {
	readonly squash: boolean
	readonly merge: boolean
	readonly rebase: boolean
}

export const allowedMergeMethodList = (allowed: RepositoryMergeMethods): readonly MergeRequestMergeMethod[] => mergeRequestMergeMethods.filter((method) => allowed[method])

export const mergeRequestReviewEvents = ["COMMENT", "APPROVE", "REQUEST_CHANGES"] as const
export type MergeRequestReviewEvent = (typeof mergeRequestReviewEvents)[number]

export interface PipelineJob {
	readonly name: string
	readonly status: PipelineStatus
	readonly stage: string
}

export interface MergeRequestLabel {
	readonly name: string
	readonly color: string | null
}

export interface CreateMergeRequestCommentInput {
	readonly repository: string
	readonly number: number
	readonly commitId?: string
	readonly path?: string
	readonly line?: number
	readonly side?: DiffCommentSide
	readonly startLine?: number
	readonly startSide?: DiffCommentSide
	readonly body: string
}

export interface SubmitMergeRequestReviewInput {
	readonly repository: string
	readonly number: number
	readonly event: MergeRequestReviewEvent
	readonly body: string
}

export interface MergeRequestReviewComment {
	readonly id: string
	readonly path: string
	readonly line: number
	readonly side: DiffCommentSide
	readonly author: string
	readonly body: string
	readonly createdAt: Date | null
	readonly url: string | null
	readonly inReplyTo: string | null
}

export type MergeRequestComment =
	| {
			readonly _tag: "comment"
			readonly id: string
			readonly author: string
			readonly body: string
			readonly createdAt: Date | null
			readonly url: string | null
	  }
	| ({ readonly _tag: "review-comment" } & MergeRequestReviewComment)

export const isReviewComment = (comment: MergeRequestComment): comment is MergeRequestComment & { readonly _tag: "review-comment" } => comment._tag === "review-comment"
export const isIssueComment = (comment: MergeRequestComment): comment is MergeRequestComment & { readonly _tag: "comment" } => comment._tag === "comment"

export interface MergeRequestItem {
	readonly repository: string
	readonly author: string
	readonly headRefOid: string
	readonly headRefName: string
	readonly number: number
	readonly title: string
	readonly body: string
	readonly labels: readonly MergeRequestLabel[]
	readonly additions: number
	readonly deletions: number
	readonly changedFiles: number
	readonly state: MergeRequestState
	readonly isDraft: boolean
	readonly reviewStatus: ReviewStatus
	readonly checkStatus: CheckRollupStatus
	readonly checkSummary: string | null
	readonly checks: readonly PipelineJob[]
	readonly autoMergeEnabled: boolean
	readonly detailLoaded: boolean
	readonly createdAt: Date
	readonly closedAt: Date | null
	readonly url: string
}

export interface MergeRequestPage {
	readonly items: readonly MergeRequestItem[]
	readonly endCursor: string | null
	readonly hasNextPage: boolean
}

export interface ListMergeRequestPageInput {
	readonly mode: MergeRequestQueueMode
	readonly repository: string | null
	readonly cursor: string | null
	readonly pageSize: number
}

export interface MergeRequestMergeInfo {
	readonly repository: string
	readonly number: number
	readonly title: string
	readonly state: MergeRequestState
	readonly isDraft: boolean
	readonly mergeable: Mergeable
	readonly reviewStatus: ReviewStatus
	readonly checkStatus: CheckRollupStatus
	readonly checkSummary: string | null
	readonly autoMergeEnabled: boolean
	readonly viewerCanMergeAsAdmin: boolean
}

// Keep these as aliases for backward compatibility with UI files
export type PullRequestState = MergeRequestState
export type PullRequestQueueMode = MergeRequestQueueMode
export type PullRequestUserQueueMode = MergeRequestUserQueueMode
export type ReviewStatus_ = ReviewStatus
export type CheckRollupStatus_ = CheckRollupStatus
export type PullRequestItem = MergeRequestItem
export type PullRequestPage = MergeRequestPage
export type PullRequestComment = MergeRequestComment
export type PullRequestReviewComment = MergeRequestReviewComment
export type PullRequestLabel = MergeRequestLabel
export type PullRequestMergeInfo = MergeRequestMergeInfo
export type PullRequestMergeMethod = MergeRequestMergeMethod
export type PullRequestMergeKind = MergeRequestMergeKind
export type PullRequestMergeAction = MergeRequestMergeAction
export type PullRequestMergeMethodKind = MergeRequestMergeMethodKind
export type CreatePullRequestCommentInput = CreateMergeRequestCommentInput
export type SubmitPullRequestReviewInput = SubmitMergeRequestReviewInput
export type PullRequestReviewEvent = MergeRequestReviewEvent
export type CheckItem = PipelineJob
export type ListPullRequestPageInput = ListMergeRequestPageInput
export const pullRequestStates = mergeRequestStates
export const pullRequestQueueModes = mergeRequestQueueModes
export const pullRequestQueueLabels = mergeRequestQueueLabels
export const pullRequestMergeMethods = mergeRequestMergeMethods
export const pullRequestMergeKinds = mergeRequestMergeKinds
export const pullRequestReviewEvents = mergeRequestReviewEvents
export const checkRunStatuses = pipelineStatuses
export type CheckRunStatus = PipelineStatus

// Backward-compat aliases — GitLab has no GitHub-style check conclusions;
// we treat pipeline status values as the conclusion equivalents.
export const checkConclusions = pipelineStatuses
export type CheckConclusion = PipelineStatus

export const pullRequestQueueSearchQualifier = (mode: MergeRequestQueueMode, _repository: string | null) => {
	// For GitLab, scope filtering is done via API params
	return mode
}
