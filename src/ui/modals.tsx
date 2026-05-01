import { TextAttributes } from "@opentui/core"
import { Data } from "effect"
import { formatShortDate, formatTimestamp } from "../date.js"
import type { PullRequestLabel, PullRequestMergeInfo, PullRequestReviewComment } from "../domain.js"
import { availableMergeActions } from "../mergeActions.js"
import { clampCursor, commentEditorLines, cursorLineIndexForLines } from "./commentEditor.js"
import { colors, filterThemeDefinitions, themeDefinitions, type ThemeId } from "./colors.js"
import { centerCell, Divider, fitCell, ModalFrame, PlainLine, TextLine } from "./primitives.js"
import { labelColor, shortRepoName } from "./pullRequests.js"

export interface LabelModalState {
	readonly repository: string | null
	readonly query: string
	readonly selectedIndex: number
	readonly availableLabels: readonly PullRequestLabel[]
	readonly loading: boolean
}

export interface MergeModalState {
	readonly repository: string | null
	readonly number: number | null
	readonly selectedIndex: number
	readonly loading: boolean
	readonly running: boolean
	readonly info: PullRequestMergeInfo | null
	readonly error: string | null
}

export interface CloseModalState {
	readonly repository: string | null
	readonly number: number | null
	readonly title: string
	readonly url: string | null
	readonly running: boolean
	readonly error: string | null
}

export interface CommentModalState {
	readonly body: string
	readonly cursor: number
	readonly error: string | null
}

export interface CommentThreadModalState {
	readonly scrollOffset: number
}

export interface ThemeModalState {
	readonly query: string
	readonly filterMode: boolean
	readonly initialThemeId: ThemeId
}

export const initialLabelModalState: LabelModalState = {
	repository: null,
	query: "",
	selectedIndex: 0,
	availableLabels: [],
	loading: false,
}

export const initialMergeModalState: MergeModalState = {
	repository: null,
	number: null,
	selectedIndex: 0,
	loading: false,
	running: false,
	info: null,
	error: null,
}

export const initialCloseModalState: CloseModalState = {
	repository: null,
	number: null,
	title: "",
	url: null,
	running: false,
	error: null,
}

export const initialCommentModalState: CommentModalState = {
	body: "",
	cursor: 0,
	error: null,
}

export const initialCommentThreadModalState: CommentThreadModalState = {
	scrollOffset: 0,
}

export const initialThemeModalState: ThemeModalState = {
	query: "",
	filterMode: false,
	initialThemeId: "ghui",
}

export type Modal = Data.TaggedEnum<{
	None: {}
	Label: LabelModalState
	Close: CloseModalState
	Merge: MergeModalState
	Comment: CommentModalState
	CommentThread: CommentThreadModalState
	Theme: ThemeModalState
}>

export const Modal = Data.taggedEnum<Modal>()
export const initialModal: Modal = Modal.None()

export type ModalTag = Modal["_tag"]
export type ModalState<Tag extends Exclude<ModalTag, "None">> = Omit<Extract<Modal, { _tag: Tag }>, "_tag">

export const modalInitialStates = {
	Label: initialLabelModalState,
	Close: initialCloseModalState,
	Merge: initialMergeModalState,
	Comment: initialCommentModalState,
	CommentThread: initialCommentThreadModalState,
	Theme: initialThemeModalState,
} as const satisfies { [Tag in Exclude<ModalTag, "None">]: ModalState<Tag> }

const mergeUnavailableReason = (info: PullRequestMergeInfo | null) => {
	if (!info) return "Loading merge status from GitHub."
	if (info.state !== "open") return "This pull request is not open."
	if (info.isDraft) return "Draft pull requests cannot be merged."
	if (info.mergeable === "conflicting") return "This branch has merge conflicts."
	return "No merge actions are currently available."
}

export const LabelModal = ({
	state,
	currentLabels,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
	loadingIndicator,
}: {
	state: LabelModalState
	currentLabels: readonly PullRequestLabel[]
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
	loadingIndicator: string
}) => {
	const innerWidth = Math.max(16, modalWidth - 2)
	const contentWidth = Math.max(14, innerWidth - 2)
	const rowWidth = innerWidth
	const currentNames = new Set(currentLabels.map((l) => l.name.toLowerCase()))
	const filtered = state.availableLabels.filter((label) =>
		state.query.length === 0 || label.name.toLowerCase().includes(state.query.toLowerCase()),
	)
	const maxVisible = Math.max(1, modalHeight - 7)
	const labelMessageTopRows = Math.max(0, Math.floor((maxVisible - 1) / 2))
	const labelMessageBottomRows = Math.max(0, maxVisible - labelMessageTopRows - 1)
	const selectedIndex = filtered.length === 0 ? 0 : Math.max(0, Math.min(state.selectedIndex, filtered.length - 1))
	const scrollStart = Math.min(
		Math.max(0, filtered.length - maxVisible),
		Math.max(0, selectedIndex - maxVisible + 1),
	)
	const visibleLabels = filtered.slice(scrollStart, scrollStart + maxVisible)
	const title = state.repository ? `Labels  ${shortRepoName(state.repository)}` : "Labels"
	const countText = state.loading ? "loading" : `${filtered.length}/${state.availableLabels.length}`
	const headerGap = Math.max(1, contentWidth - title.length - countText.length)
	const queryText = state.query.length > 0 ? state.query : "type to filter labels"
	const queryPrefix = state.query.length > 0 ? "/ " : "/ "
	const queryWidth = Math.max(1, contentWidth - queryPrefix.length)

	return (
		<ModalFrame left={offsetLeft} top={offsetTop} width={modalWidth} height={modalHeight} junctionRows={[2, modalHeight - 4]}>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.accent} attributes={TextAttributes.BOLD}>{title}</span>
					<span fg={colors.muted}>{" ".repeat(headerGap)}</span>
					<span fg={colors.muted}>{countText}</span>
				</TextLine>
			</box>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.count}>{queryPrefix}</span>
					<span fg={state.query.length > 0 ? colors.text : colors.muted}>{fitCell(queryText, queryWidth)}</span>
				</TextLine>
			</box>
			<Divider width={innerWidth} />
			<box height={maxVisible} flexDirection="column">
				{state.loading ? (
					<>
						{Array.from({ length: labelMessageTopRows }, (_, index) => <box key={`top-${index}`} height={1} />)}
						<PlainLine text={centerCell(`${loadingIndicator} Loading labels`, rowWidth)} fg={colors.muted} />
						{Array.from({ length: labelMessageBottomRows }, (_, index) => <box key={`bottom-${index}`} height={1} />)}
					</>
				) : visibleLabels.length === 0 ? (
					<>
						{Array.from({ length: labelMessageTopRows }, (_, index) => <box key={`top-${index}`} height={1} />)}
						<PlainLine text={centerCell(state.query.length > 0 ? "No matching labels" : "No labels found", rowWidth)} fg={colors.muted} />
						{Array.from({ length: labelMessageBottomRows }, (_, index) => <box key={`bottom-${index}`} height={1} />)}
					</>
				) : (
					visibleLabels.map((label, index) => {
						const actualIndex = scrollStart + index
						const isActive = currentNames.has(label.name.toLowerCase())
						const isSelected = actualIndex === selectedIndex
						const marker = isActive ? "✓" : " "
						const nameWidth = Math.max(1, rowWidth - 5)
						return (
							<box key={label.name} height={1}>
								<TextLine bg={isSelected ? colors.selectedBg : undefined} fg={isSelected ? colors.selectedText : colors.text}>
									<span fg={isActive ? colors.status.passing : colors.muted}>{marker}</span>
									<span> </span>
									<span bg={labelColor(label)}>  </span>
									<span> {fitCell(label.name, nameWidth)}</span>
								</TextLine>
							</box>
						)
					})
				)}
			</box>
			<Divider width={innerWidth} />
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.count}>↑↓</span>
					<span fg={colors.muted}> move  </span>
					<span fg={colors.count}>esc</span>
					<span fg={colors.muted}> close</span>
					{filtered.length > maxVisible ? <span fg={colors.muted}>  {selectedIndex + 1}/{filtered.length}</span> : null}
				</TextLine>
			</box>
		</ModalFrame>
	)
}

export const MergeModal = ({
	state,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
	loadingIndicator,
}: {
	state: MergeModalState
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
	loadingIndicator: string
}) => {
	const innerWidth = Math.max(16, modalWidth - 2)
	const contentWidth = Math.max(14, innerWidth - 2)
	const rowWidth = innerWidth
	const options = availableMergeActions(state.info)
	const selectedIndex = options.length === 0 ? 0 : Math.max(0, Math.min(state.selectedIndex, options.length - 1))
	const title = state.info ? `Merge  #${state.info.number}` : state.number ? `Merge  #${state.number}` : "Merge"
	const rightText = state.running ? `${loadingIndicator} running` : state.loading ? `${loadingIndicator} loading` : state.info?.autoMergeEnabled ? "auto on" : "manual"
	const headerGap = Math.max(1, contentWidth - title.length - rightText.length)
	const repo = state.info?.repository ?? state.repository
	const statusLine = state.info
		? `${shortRepoName(state.info.repository)}  ${state.info.mergeable}  ${state.info.reviewStatus}  ${state.info.checkSummary ?? state.info.checkStatus}`
		: repo ? shortRepoName(repo) : ""
	const optionAreaHeight = Math.max(1, modalHeight - 7)
	const optionRows = Math.max(1, Math.floor(optionAreaHeight / 2))
	const visibleOptions = options.slice(0, optionRows)
	const loadingTopRows = Math.max(0, Math.floor((optionAreaHeight - 1) / 2))
	const loadingBottomRows = Math.max(0, optionAreaHeight - loadingTopRows - 1)

	return (
		<ModalFrame left={offsetLeft} top={offsetTop} width={modalWidth} height={modalHeight} junctionRows={[2, modalHeight - 4]}>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.accent} attributes={TextAttributes.BOLD}>{title}</span>
					<span fg={colors.muted}>{" ".repeat(headerGap)}</span>
					<span fg={state.running || state.loading ? colors.status.pending : colors.muted}>{rightText}</span>
				</TextLine>
			</box>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<PlainLine text={fitCell(statusLine, contentWidth)} fg={colors.muted} />
			</box>
			<Divider width={innerWidth} />
			<box height={optionAreaHeight} flexDirection="column">
				{state.loading ? (
					<>
						{Array.from({ length: loadingTopRows }, (_, index) => <box key={`top-${index}`} height={1} />)}
						<PlainLine text={centerCell(`${loadingIndicator} Loading merge status`, rowWidth)} fg={colors.muted} />
						{Array.from({ length: loadingBottomRows }, (_, index) => <box key={`bottom-${index}`} height={1} />)}
					</>
				) : state.error ? (
					<PlainLine text={centerCell(state.error, rowWidth)} fg={colors.error} />
				) : visibleOptions.length === 0 ? (
					<PlainLine text={centerCell(mergeUnavailableReason(state.info), rowWidth)} fg={colors.muted} />
				) : (
					visibleOptions.map((option, index) => {
						const isSelected = index === selectedIndex
						const titleColor = option.danger ? colors.error : isSelected ? colors.selectedText : colors.text
						const titleWidth = Math.max(1, rowWidth - 1)
						const descriptionWidth = Math.max(1, rowWidth - 1)

						return (
							<box key={option.action} height={2} flexDirection="column">
								<TextLine bg={isSelected ? colors.selectedBg : undefined}>
									<span fg={titleColor}> {fitCell(option.title, titleWidth)}</span>
								</TextLine>
								<TextLine bg={isSelected ? colors.selectedBg : undefined}>
									<span fg={colors.muted}> {fitCell(option.description, descriptionWidth)}</span>
								</TextLine>
							</box>
						)
					})
				)}
			</box>
			<Divider width={innerWidth} />
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.count}>↑↓</span>
					<span fg={colors.muted}> move  </span>
					<span fg={colors.count}>enter</span>
					<span fg={colors.muted}> confirm  </span>
					<span fg={colors.count}>esc</span>
					<span fg={colors.muted}> close</span>
				</TextLine>
			</box>
		</ModalFrame>
	)
}

export const CloseModal = ({
	state,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
	loadingIndicator,
}: {
	state: CloseModalState
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
	loadingIndicator: string
}) => {
	const innerWidth = Math.max(16, modalWidth - 2)
	const contentWidth = Math.max(14, innerWidth - 2)
	const title = state.number ? `Close  #${state.number}` : "Close pull request"
	const rightText = state.running ? `${loadingIndicator} closing` : "confirm"
	const headerGap = Math.max(1, contentWidth - title.length - rightText.length)
	const repo = state.repository ? shortRepoName(state.repository) : ""
	const titleLines = [
		fitCell(repo, contentWidth),
		fitCell(state.title, contentWidth),
	]
	const bodyHeight = Math.max(1, modalHeight - 7)
	const topRows = Math.max(0, Math.floor((bodyHeight - titleLines.length - 2) / 2))
	const bottomRows = Math.max(0, bodyHeight - topRows - titleLines.length - 2)

	return (
		<ModalFrame left={offsetLeft} top={offsetTop} width={modalWidth} height={modalHeight} junctionRows={[2, modalHeight - 4]}>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.error} attributes={TextAttributes.BOLD}>{title}</span>
					<span fg={colors.muted}>{" ".repeat(headerGap)}</span>
					<span fg={state.running ? colors.status.pending : colors.muted}>{rightText}</span>
				</TextLine>
			</box>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<PlainLine text={fitCell("This will close the pull request without merging it.", contentWidth)} fg={colors.muted} />
			</box>
			<Divider width={innerWidth} />
			<box height={bodyHeight} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{state.error ? (
					<PlainLine text={fitCell(state.error, contentWidth)} fg={colors.error} />
				) : (
					<>
						{Array.from({ length: topRows }, (_, index) => <box key={`top-${index}`} height={1} />)}
						<PlainLine text={titleLines[0]!} fg={colors.muted} />
						<PlainLine text={titleLines[1]!} fg={colors.text} bold />
						{Array.from({ length: bottomRows }, (_, index) => <box key={`bottom-${index}`} height={1} />)}
					</>
				)}
			</box>
			<Divider width={innerWidth} />
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.count}>enter</span>
					<span fg={colors.muted}> close  </span>
					<span fg={colors.count}>esc</span>
					<span fg={colors.muted}> cancel</span>
				</TextLine>
			</box>
		</ModalFrame>
	)
}

export const CommentModal = ({
	state,
	anchorLabel,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
}: {
	state: CommentModalState
	anchorLabel: string
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
}) => {
	const innerWidth = Math.max(16, modalWidth - 2)
	const contentWidth = Math.max(14, innerWidth - 2)
	const title = "Comment"
	const rightText = "enter save"
	const headerGap = Math.max(1, contentWidth - title.length - rightText.length)
	const bodyHeight = Math.max(1, modalHeight - 7)
	const editorHeight = Math.max(1, bodyHeight - (state.error ? 1 : 0))
	const lineRanges = commentEditorLines(state.body)
	const cursor = clampCursor(state.body, state.cursor)
	const cursorLineIndex = cursorLineIndexForLines(lineRanges, cursor)
	const visibleStart = Math.min(
		Math.max(0, lineRanges.length - editorHeight),
		Math.max(0, cursorLineIndex - editorHeight + 1),
	)
	const visibleLines = lineRanges.slice(visibleStart, visibleStart + editorHeight)
	const renderEditorLine = (line: { readonly text: string; readonly start: number; readonly end: number }, index: number) => {
		const lineIndex = visibleStart + index
		const isCursorLine = lineIndex === cursorLineIndex
		const cursorColumn = Math.max(0, Math.min(cursor - line.start, line.text.length))
		const viewStart = isCursorLine ? Math.max(0, cursorColumn - contentWidth + 1) : 0
		const visibleText = line.text.slice(viewStart, viewStart + contentWidth)

		if (!isCursorLine) {
			return <PlainLine key={lineIndex} text={fitCell(visibleText, contentWidth)} fg={state.body.length > 0 ? colors.text : colors.muted} />
		}

		const cursorInView = cursorColumn - viewStart
		const before = visibleText.slice(0, cursorInView)
		const placeholder = state.body.length === 0 ? "Write a comment..." : ""
		const cursorChar = placeholder ? placeholder[0] ?? " " : visibleText[cursorInView] ?? " "
		const after = placeholder ? placeholder.slice(1) : visibleText.slice(cursorInView + 1)

		return (
			<TextLine key={lineIndex}>
				{before ? <span fg={colors.text}>{before}</span> : null}
				<span bg={colors.accent} fg={colors.background}>{cursorChar}</span>
				{after ? <span fg={placeholder ? colors.muted : colors.text}>{after}</span> : null}
			</TextLine>
		)
	}

	return (
		<ModalFrame left={offsetLeft} top={offsetTop} width={modalWidth} height={modalHeight} junctionRows={[2, modalHeight - 4]}>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.accent} attributes={TextAttributes.BOLD}>{title}</span>
					<span fg={colors.muted}>{" ".repeat(headerGap)}</span>
					<span fg={colors.muted}>{rightText}</span>
				</TextLine>
			</box>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<PlainLine text={fitCell(anchorLabel, contentWidth)} fg={colors.muted} />
			</box>
			<Divider width={innerWidth} />
			<box height={bodyHeight} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{state.error ? <PlainLine text={fitCell(state.error, contentWidth)} fg={colors.error} /> : null}
				{visibleLines.map(renderEditorLine)}
			</box>
			<Divider width={innerWidth} />
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.count}>enter</span>
					<span fg={colors.muted}> save  </span>
					<span fg={colors.count}>shift-enter</span>
					<span fg={colors.muted}> newline  </span>
					<span fg={colors.count}>esc</span>
					<span fg={colors.muted}> cancel</span>
				</TextLine>
			</box>
		</ModalFrame>
	)
}

type CommentThreadRow = {
	readonly key: string
	readonly text: string
	readonly fg: string
	readonly bold?: boolean
}

const wrapCommentBody = (body: string, width: number) => {
	const lines = body.length === 0 ? [""] : body.split("\n")
	return lines.flatMap((line) => {
		if (line.length === 0) return [""]
		const wrapped: string[] = []
		for (let index = 0; index < line.length; index += width) {
			wrapped.push(line.slice(index, index + width))
		}
		return wrapped
	})
}

const formatCommentDate = (date: Date | null) => date ? `${formatShortDate(date)} ${formatTimestamp(date)}` : ""

const commentThreadRows = (comments: readonly PullRequestReviewComment[], width: number): readonly CommentThreadRow[] =>
	comments.flatMap((comment, commentIndex) => {
		const timestamp = formatCommentDate(comment.createdAt)
		const header = timestamp ? `${comment.author}  ${timestamp}` : comment.author
		return [
			{ key: `${comment.id}:header`, text: header, fg: colors.count, bold: true },
			...wrapCommentBody(comment.body, width).map((line, lineIndex) => ({
				key: `${comment.id}:body:${lineIndex}`,
				text: line,
				fg: colors.text,
			})),
			...(commentIndex < comments.length - 1 ? [{ key: `${comment.id}:gap`, text: "", fg: colors.muted }] : []),
		]
	})

export const CommentThreadModal = ({
	state,
	anchorLabel,
	comments,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
}: {
	state: CommentThreadModalState
	anchorLabel: string
	comments: readonly PullRequestReviewComment[]
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
}) => {
	const innerWidth = Math.max(16, modalWidth - 2)
	const contentWidth = Math.max(14, innerWidth - 2)
	const title = "Thread"
	const countText = comments.length === 1 ? "1 comment" : `${comments.length} comments`
	const headerGap = Math.max(1, contentWidth - title.length - countText.length)
	const bodyHeight = Math.max(1, modalHeight - 7)
	const rows = commentThreadRows(comments, contentWidth)
	const maxScroll = Math.max(0, rows.length - bodyHeight)
	const scrollOffset = Math.max(0, Math.min(state.scrollOffset, maxScroll))
	const visibleRows = rows.slice(scrollOffset, scrollOffset + bodyHeight)

	return (
		<ModalFrame left={offsetLeft} top={offsetTop} width={modalWidth} height={modalHeight} junctionRows={[2, modalHeight - 4]}>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.accent} attributes={TextAttributes.BOLD}>{title}</span>
					<span fg={colors.muted}>{" ".repeat(headerGap)}</span>
					<span fg={colors.muted}>{countText}</span>
				</TextLine>
			</box>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<PlainLine text={fitCell(anchorLabel, contentWidth)} fg={colors.muted} />
			</box>
			<Divider width={innerWidth} />
			<box height={bodyHeight} flexDirection="column" paddingLeft={1} paddingRight={1}>
				{visibleRows.length === 0 ? (
					<PlainLine text={fitCell("No comments on this line.", contentWidth)} fg={colors.muted} />
				) : visibleRows.map((row) => (
					<PlainLine key={row.key} text={fitCell(row.text, contentWidth)} fg={row.fg} bold={row.bold ?? false} />
				))}
			</box>
			<Divider width={innerWidth} />
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.count}>↑↓</span>
					<span fg={colors.muted}> scroll  </span>
					<span fg={colors.count}>a</span>
					<span fg={colors.muted}> comment  </span>
					<span fg={colors.count}>esc</span>
					<span fg={colors.muted}> close</span>
				</TextLine>
			</box>
		</ModalFrame>
	)
}

export const ThemeModal = ({
	state,
	activeThemeId,
	modalWidth,
	modalHeight,
	offsetLeft,
	offsetTop,
}: {
	state: ThemeModalState
	activeThemeId: ThemeId
	modalWidth: number
	modalHeight: number
	offsetLeft: number
	offsetTop: number
}) => {
	const innerWidth = Math.max(16, modalWidth - 2)
	const contentWidth = Math.max(14, innerWidth - 2)
	const rowWidth = innerWidth
	const filteredThemes = filterThemeDefinitions(state.query)
	const maxVisible = Math.max(1, modalHeight - 7)
	const activeIndex = filteredThemes.findIndex((theme) => theme.id === activeThemeId)
	const selectedIndex = Math.max(0, activeIndex)
	const selectedTheme = filteredThemes[selectedIndex] ?? themeDefinitions.find((theme) => theme.id === activeThemeId) ?? themeDefinitions[0]!
	const scrollStart = Math.min(
		Math.max(0, filteredThemes.length - maxVisible),
		Math.max(0, selectedIndex - maxVisible + 1),
	)
	const visibleThemes = filteredThemes.slice(scrollStart, scrollStart + maxVisible)
	const countText = `${filteredThemes.length === 0 ? 0 : selectedIndex + 1}/${filteredThemes.length}`
	const title = "Themes"
	const headerGap = Math.max(1, contentWidth - title.length - countText.length)
	const subtitleText = state.filterMode ? (state.query.length > 0 ? state.query : "type to filter themes") : selectedTheme.description
	const queryPrefix = "/ "
	const subtitleWidth = Math.max(1, contentWidth - (state.filterMode ? queryPrefix.length : 0))
	const messageTopRows = Math.max(0, Math.floor((maxVisible - 1) / 2))
	const messageBottomRows = Math.max(0, maxVisible - messageTopRows - 1)

	return (
		<ModalFrame left={offsetLeft} top={offsetTop} width={modalWidth} height={modalHeight} junctionRows={[2, modalHeight - 4]}>
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.accent} attributes={TextAttributes.BOLD}>{title}</span>
					<span fg={colors.muted}>{" ".repeat(headerGap)}</span>
					<span fg={colors.muted}>{countText}</span>
				</TextLine>
			</box>
			<box height={1} paddingLeft={1} paddingRight={1}>
				{state.filterMode ? (
					<TextLine>
						<span fg={colors.count}>{queryPrefix}</span>
						<span fg={state.query.length > 0 ? colors.text : colors.muted}>{fitCell(subtitleText, subtitleWidth)}</span>
					</TextLine>
				) : (
					<PlainLine text={fitCell(subtitleText, subtitleWidth)} fg={colors.muted} />
				)}
			</box>
			<Divider width={innerWidth} />
			<box height={maxVisible} flexDirection="column">
				{visibleThemes.length === 0 ? (
					<>
						{Array.from({ length: messageTopRows }, (_, index) => <box key={`top-${index}`} height={1} />)}
						<PlainLine text={centerCell("No matching themes", rowWidth)} fg={colors.muted} />
						{Array.from({ length: messageBottomRows }, (_, index) => <box key={`bottom-${index}`} height={1} />)}
					</>
				) : visibleThemes.map((theme, index) => {
					const actualIndex = scrollStart + index
					const isSelected = actualIndex === selectedIndex
					const isActive = theme.id === activeThemeId
					const marker = isActive ? "✓" : " "
					const swatchWidth = 6
					const nameWidth = Math.max(1, rowWidth - swatchWidth - 3)

					return (
						<TextLine key={theme.id} bg={isSelected ? colors.selectedBg : undefined} fg={isSelected ? colors.selectedText : colors.text}>
							<span fg={isActive ? colors.status.passing : colors.muted}>{marker}</span>
							<span> </span>
							<span>{fitCell(theme.name, nameWidth)}</span>
							<span bg={theme.colors.background}> </span>
							<span bg={theme.colors.modalBackground}> </span>
							<span bg={theme.colors.accent}> </span>
							<span bg={theme.colors.status.passing}> </span>
							<span bg={theme.colors.status.failing}> </span>
							<span bg={theme.colors.status.review}> </span>
						</TextLine>
					)
				})}
			</box>
			<Divider width={innerWidth} />
			<box height={1} paddingLeft={1} paddingRight={1}>
				<TextLine>
					<span fg={colors.count}>↑↓</span>
					<span fg={colors.muted}> preview  </span>
					<span fg={colors.count}>/</span>
					<span fg={colors.muted}> filter  </span>
					<span fg={colors.count}>enter</span>
					<span fg={colors.muted}> select  </span>
					<span fg={colors.count}>esc</span>
					<span fg={colors.muted}> cancel</span>
				</TextLine>
			</box>
		</ModalFrame>
	)
}
