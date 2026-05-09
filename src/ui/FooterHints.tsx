import { Data } from "effect"
import type { AppSection } from "../domain.js"
import { colors } from "./colors.js"
import { HintRow, type HintItem } from "./primitives.js"

export type RetryProgress = Data.TaggedEnum<{
	Idle: {}
	Retrying: { readonly attempt: number; readonly max: number }
}>

export const RetryProgress = Data.taggedEnum<RetryProgress>()
export const initialRetryProgress: RetryProgress = RetryProgress.Idle()

interface HintsContext {
	readonly filterEditing: boolean
	readonly showFilterClear: boolean
	readonly detailFullView: boolean
	readonly diffFullView: boolean
	readonly diffRangeActive: boolean
	readonly commentsViewActive: boolean
	readonly commentsViewOnRealComment: boolean
	readonly commentsViewCanEditSelected: boolean
	readonly commentsViewCount: number
	readonly hasSelection: boolean
	readonly hasError: boolean
	readonly isLoading: boolean
	readonly loadingIndicator: string
	readonly retryProgress: RetryProgress
	readonly selectedPullRequestOpen: boolean
	readonly section: AppSection
}

const filterEditingHints: readonly HintItem[] = [
	{ key: "search", label: "typing" },
	{ key: "↑↓", label: "move" },
	{ key: "enter", label: "apply" },
	{ key: "esc", label: "cancel" },
	{ key: "ctrl-u", label: "clear" },
	{ key: "ctrl-w", label: "word" },
]

const diffViewHints = (ctx: HintsContext): readonly HintItem[] => [
	{ key: "esc", label: "back" },
	{ key: "↑↓", label: ctx.diffRangeActive ? "range" : "line" },
	{ key: "enter", label: ctx.diffRangeActive ? "comment" : "open" },
	{ key: "v", label: ctx.diffRangeActive ? "clear" : "range" },
	{ key: "w", label: "wrap" },
	{ key: "[]", label: "files" },
	{ key: "r", label: "reload" },
]

const detailFullViewHints = (ctx: HintsContext): readonly HintItem[] => [
	{ key: "esc", label: "back" },
	{ key: "↑↓", label: "scroll" },
	{ key: "r", label: ctx.hasError ? "retry" : "refresh" },
	{ key: "d", label: "diff", when: ctx.hasSelection },
	{ key: "o", label: "browser", when: ctx.hasSelection },
	{ key: "shift-r", label: "approve", when: ctx.selectedPullRequestOpen },
	{ key: "m", label: "merge", when: ctx.selectedPullRequestOpen },
	{ key: "l", label: "labels", when: ctx.hasSelection },
]

const workspaceHints = (ctx: HintsContext): readonly HintItem[] => [
	{ key: "/", label: "filter" },
	{ key: "enter", label: "details", when: ctx.hasSelection },
	{ key: "b", label: "branch", when: ctx.hasSelection },
	{ key: "o", label: "browser", when: ctx.hasSelection },
	{ key: "r", label: ctx.hasError ? "retry" : "refresh" },
	{ key: "1-4", label: "section" },
	{ key: "ctrl-p", label: "commands" },
]

const issuesHints = (ctx: HintsContext): readonly HintItem[] => [
	{ key: "/", label: "filter" },
	{ key: "enter", label: "details", when: ctx.hasSelection },
	{ key: "b", label: "primary", when: ctx.hasSelection },
	{ key: "n", label: "branch", when: ctx.hasSelection },
	{ key: "m", label: "mr", when: ctx.hasSelection },
	{ key: "o", label: "browser", when: ctx.hasSelection },
	{ key: "r", label: ctx.hasError ? "retry" : "refresh" },
	{ key: "1-4", label: "section" },
]

const epicsHints = (ctx: HintsContext): readonly HintItem[] => [
	{ key: "/", label: "filter" },
	{ key: "enter", label: "details", when: ctx.hasSelection },
	{ key: "b", label: "checkout", when: ctx.hasSelection },
	{ key: "m", label: "bulk mr", when: ctx.hasSelection },
	{ key: "o", label: "browser", when: ctx.hasSelection },
	{ key: "r", label: ctx.hasError ? "retry" : "refresh" },
	{ key: "1-4", label: "section" },
]

const commentsViewHints = (ctx: HintsContext): readonly HintItem[] => [
	{ key: "↑↓", label: "move", disabled: ctx.commentsViewCount <= 1 },
	{ key: "enter", label: ctx.commentsViewOnRealComment ? "reply" : "new" },
	{ key: "a", label: "new" },
	{ key: "e", label: "edit", disabled: !ctx.commentsViewCanEditSelected },
	{ key: "x", label: "delete", disabled: !ctx.commentsViewCanEditSelected },
	{ key: "o", label: "open", disabled: !ctx.commentsViewOnRealComment },
	{ key: "r", label: "refresh" },
	{ key: "esc", label: "close" },
]

const defaultHints = (ctx: HintsContext): readonly HintItem[] => {
	const retrying = ctx.retryProgress._tag === "Retrying"
	return [
		{ key: "/", label: "filter" },
		{ key: "esc", label: "clear", when: ctx.showFilterClear },
		{
			key: "retry",
			label: retrying ? `${(ctx.retryProgress as { attempt: number; max: number }).attempt}/${(ctx.retryProgress as { attempt: number; max: number }).max}` : "",
			when: retrying,
			keyFg: colors.status.pending,
		},
		{ key: ctx.loadingIndicator, label: "loading", when: !retrying && ctx.isLoading, keyFg: colors.status.pending },
		{ key: "r", label: "retry", when: ctx.hasError },
		{ key: "enter", label: "details", when: ctx.hasSelection },
		{ key: "d", label: "diff", when: ctx.hasSelection },
		{ key: "ctrl-p", label: "commands" },
	]
}

const footerHints = (ctx: HintsContext): readonly HintItem[] => {
	if (ctx.filterEditing) return filterEditingHints
	if (ctx.commentsViewActive) return commentsViewHints(ctx)
	if (ctx.diffFullView) return diffViewHints(ctx)
	if (ctx.detailFullView) return detailFullViewHints(ctx)
	if (ctx.section === "workspace") return workspaceHints(ctx)
	if (ctx.section === "issues") return issuesHints(ctx)
	if (ctx.section === "epics") return epicsHints(ctx)
	return defaultHints(ctx)
}

export const FooterHints = (props: HintsContext) => <HintRow items={footerHints(props)} />
