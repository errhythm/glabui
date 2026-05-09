import type {
	MergeRequestItem,
	MergeRequestMergeAction,
	MergeRequestMergeInfo,
	MergeRequestMergeKind,
	MergeRequestMergeMethod,
	MergeRequestState,
	RepositoryMergeMethods,
} from "./domain.js"

export interface MergeKindDefinition {
	readonly kind: MergeRequestMergeKind
	readonly title: (method: MergeRequestMergeMethod) => string
	readonly description: (method: MergeRequestMergeMethod) => string
	readonly pastTense: (method: MergeRequestMergeMethod) => string
	readonly danger?: boolean
	readonly refreshOnSuccess?: boolean
	readonly optimisticState?: MergeRequestState
	readonly optimisticAutoMergeEnabled?: boolean
	readonly methodAgnostic?: boolean
	readonly isAvailable: (info: MergeRequestMergeInfo) => boolean
}

const isCleanlyMergeable = (info: MergeRequestMergeInfo) =>
	info.state === "open" &&
	!info.isDraft &&
	info.mergeable === "mergeable" &&
	info.reviewStatus !== "changes" &&
	info.reviewStatus !== "review" &&
	info.checkStatus !== "pending" &&
	info.checkStatus !== "failing"

interface MethodCopy {
	readonly verb: string
	readonly pastTense: string
	readonly autoDescription: string
	readonly adminDescription: string
	readonly cliFlag: string
}

const methodCopy = {
	squash: {
		verb: "Squash and merge",
		pastTense: "Merged",
		autoDescription: "Squash and merge automatically once GitLab pipeline passes.",
		adminDescription: "Bypass merge requirements and squash merge.",
		cliFlag: "--squash",
	},
	merge: {
		verb: "Create a merge commit",
		pastTense: "Merged",
		autoDescription: "Create a merge commit automatically once GitLab pipeline passes.",
		adminDescription: "Bypass merge requirements and create a merge commit.",
		cliFlag: "--merge",
	},
	rebase: {
		verb: "Rebase and merge",
		pastTense: "Rebased",
		autoDescription: "Rebase and merge automatically once GitLab pipeline passes.",
		adminDescription: "Bypass merge requirements and rebase merge.",
		cliFlag: "--rebase",
	},
} as const satisfies Record<MergeRequestMergeMethod, MethodCopy>

const mergeKindDefinitions = {
	now: {
		kind: "now",
		title: (method) => `${methodCopy[method].verb} now`,
		description: () => "Merge this merge request and delete the branch.",
		pastTense: (method) => methodCopy[method].pastTense,
		refreshOnSuccess: true,
		optimisticState: "merged",
		isAvailable: isCleanlyMergeable,
	},
	when_pipeline_succeeds: {
		kind: "when_pipeline_succeeds",
		title: () => "Merge when pipeline succeeds",
		description: (method) => methodCopy[method].autoDescription,
		pastTense: () => "Set to merge when pipeline succeeds",
		optimisticAutoMergeEnabled: true,
		isAvailable: (info) => info.state === "open" && !info.autoMergeEnabled && !info.isDraft && info.mergeable !== "conflicting",
	},
	"disable-auto": {
		kind: "disable-auto",
		title: () => "Cancel auto-merge",
		description: () => "Cancel the pending GitLab merge when pipeline succeeds.",
		pastTense: () => "Cancelled auto-merge",
		optimisticAutoMergeEnabled: false,
		methodAgnostic: true,
		isAvailable: (info) => info.state === "open" && info.autoMergeEnabled,
	},
	admin: {
		kind: "admin",
		title: (method) => `${methodCopy[method].verb} (force)`,
		description: (method) => methodCopy[method].adminDescription,
		pastTense: () => "Force merged",
		danger: true,
		refreshOnSuccess: true,
		optimisticState: "merged",
		isAvailable: (info) => info.viewerCanMergeAsAdmin && info.state === "open" && !info.isDraft && info.mergeable !== "conflicting",
	},
} as const satisfies Record<MergeRequestMergeKind, MergeKindDefinition>

export const mergeKinds: readonly MergeKindDefinition[] = Object.values(mergeKindDefinitions)

export const availableMergeKinds = (info: MergeRequestMergeInfo | null): readonly MergeKindDefinition[] => {
	if (!info) return []
	return mergeKinds.filter((kind) => kind.isAvailable(info))
}

export const visibleMergeKinds = (
	info: MergeRequestMergeInfo | null,
	allowed: RepositoryMergeMethods | null,
	selected: MergeRequestMergeMethod,
): readonly MergeKindDefinition[] => {
	if (!allowed || !info) return []
	const queryInfo = info.isDraft ? { ...info, isDraft: false } : info
	const available = availableMergeKinds(queryInfo)
	if (allowed[selected]) return available
	return available.filter((kind) => kind.methodAgnostic)
}

export const requiresMarkReady = (info: MergeRequestMergeInfo | null, kind: MergeKindDefinition): boolean => Boolean(info?.isDraft && !kind.methodAgnostic)

export const mergeKindRowTitle = (kind: MergeKindDefinition, method: MergeRequestMergeMethod, fromDraft: boolean): string => {
	const baseTitle = kind.title(method)
	if (!fromDraft || kind.methodAgnostic) return baseTitle
	return `Mark ready & ${baseTitle.charAt(0).toLowerCase()}${baseTitle.slice(1)}`
}

export const getMergeKindDefinition = (kind: MergeRequestMergeKind): MergeKindDefinition => mergeKindDefinitions[kind]

export const mergeActionCliArgs = (action: MergeRequestMergeAction): readonly string[] => {
	if (action.kind === "disable-auto") return ["--disable-auto"]
	if (action.kind === "when_pipeline_succeeds") return ["--when-pipeline-succeeds"]
	if (action.kind === "admin") return ["--force"]
	// now
	if (action.method === "squash") return ["--squash"]
	if (action.method === "rebase") return ["--rebase"]
	return []
}

export const mergeInfoFromMergeRequest = (mr: MergeRequestItem): MergeRequestMergeInfo => ({
	repository: mr.repository,
	number: mr.number,
	title: mr.title,
	state: mr.state,
	isDraft: mr.reviewStatus === "draft",
	mergeable: "unknown",
	reviewStatus: mr.reviewStatus,
	checkStatus: mr.checkStatus,
	checkSummary: mr.checkSummary,
	autoMergeEnabled: mr.autoMergeEnabled,
	viewerCanMergeAsAdmin: false,
})

// alias for UI compat
export const mergeInfoFromPullRequest = mergeInfoFromMergeRequest
