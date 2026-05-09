import { TextAttributes } from "@opentui/core"
import type { EpicItem, IssueItem, LoadStatus, WorkspaceBranchSwitchResult, WorkspaceRepo } from "../domain.js"
import { formatRelativeDate } from "../date.js"
import { colors } from "./colors.js"
import { bodyPreview } from "./DetailsPane.js"
import { Divider, Filler, PaddedRow, PlainLine, TextLine, trimCell, fitCell } from "./primitives.js"

const renderBodyPreview = (body: string, width: number, lines = 10) =>
	bodyPreview(body, width, lines).map((line, index) => (
		<PaddedRow key={index}>
			<TextLine>
				{line.segments.map((segment, segmentIndex) => (
					<span key={segmentIndex} fg={segment.fg} attributes={segment.bold ? TextAttributes.BOLD : 0}>
						{segment.text}
					</span>
				))}
			</TextLine>
		</PaddedRow>
	))

export const WorkspaceDetails = ({
	repo,
	contentWidth,
	paneWidth,
	results,
}: {
	readonly repo: WorkspaceRepo | null
	readonly contentWidth: number
	readonly paneWidth: number
	readonly results: readonly WorkspaceBranchSwitchResult[]
}) => {
	if (!repo) {
		return (
			<box flexDirection="column">
				<PaddedRow>
					<PlainLine text="Select a repository" fg={colors.muted} />
				</PaddedRow>
				<Divider width={paneWidth} />
				<Filler rows={8} prefix="workspace-empty" />
			</box>
		)
	}
	const latest = results.find((result) => result.repoId === repo.id) ?? null
	return (
		<box flexDirection="column">
			<PaddedRow>
				<TextLine>
					<span fg={colors.count}>{trimCell(repo.name, Math.max(8, contentWidth - 12))}</span>
					<span fg={colors.muted}>{`  ${repo.branch}`}</span>
				</TextLine>
			</PaddedRow>
			<PaddedRow>
				<TextLine>
					<span fg={colors.muted}>project </span>
					<span fg={colors.text}>{trimCell(repo.projectPath ?? repo.path, Math.max(8, contentWidth - 8))}</span>
				</TextLine>
			</PaddedRow>
			<PaddedRow>
				<TextLine>
					<span fg={colors.muted}>status </span>
					<span fg={repo.dirty ? colors.status.pending : colors.status.passing}>{repo.dirty ? `${repo.dirtyCount} dirty` : "clean"}</span>
					<span fg={colors.muted}>{`  ${repo.ahead}↑ ${repo.behind}↓`}</span>
				</TextLine>
			</PaddedRow>
			{latest ? (
				<PaddedRow>
					<TextLine>
						<span fg={latest.status === "failed" ? colors.status.failing : latest.status === "skipped" ? colors.status.pending : colors.status.passing}>last run</span>
						<span fg={colors.muted}>{`  ${latest.message}`}</span>
					</TextLine>
				</PaddedRow>
			) : null}
			<Divider width={paneWidth} />
			<PaddedRow>
				<PlainLine text={trimCell(repo.path, contentWidth)} fg={colors.muted} />
			</PaddedRow>
		</box>
	)
}

export const IssueDetails = ({ issue, contentWidth, paneWidth }: { readonly issue: IssueItem | null; readonly contentWidth: number; readonly paneWidth: number }) => {
	if (!issue) {
		return (
			<box flexDirection="column">
				<PaddedRow>
					<PlainLine text="Select an issue" fg={colors.muted} />
				</PaddedRow>
				<Divider width={paneWidth} />
				<Filler rows={8} prefix="issue-empty" />
			</box>
		)
	}
	return (
		<box flexDirection="column">
			<PaddedRow>
				<TextLine>
					<span fg={colors.count}>{trimCell(issue.title, contentWidth)}</span>
				</TextLine>
			</PaddedRow>
			<PaddedRow>
				<TextLine>
					<span fg={colors.muted}>{`${issue.repository} #${issue.number}`}</span>
					<span fg={colors.muted}>{`  ${formatRelativeDate(issue.createdAt)}`}</span>
				</TextLine>
			</PaddedRow>
			<PaddedRow>
				<TextLine>
					<span fg={colors.muted}>state </span>
					<span fg={issue.state === "opened" ? colors.status.review : colors.muted}>{issue.state}</span>
					{issue.primaryBranch ? (
						<>
							<span fg={colors.muted}>{"  branch "}</span>
							<span fg={colors.text}>{issue.primaryBranch}</span>
						</>
					) : null}
				</TextLine>
			</PaddedRow>
			<Divider width={paneWidth} />
			{renderBodyPreview(issue.body, contentWidth, 12)}
		</box>
	)
}

export const EpicDetails = ({
	epic,
	epicIssues,
	epicIssuesStatus,
	selectedIssueIndex,
	issueFocus,
	primaryBranches,
	contentWidth,
	paneWidth,
}: {
	readonly epic: EpicItem | null
	readonly epicIssues: readonly IssueItem[]
	readonly epicIssuesStatus: LoadStatus
	readonly selectedIssueIndex: number
	readonly issueFocus: boolean
	readonly primaryBranches: Readonly<Record<string, string>>
	readonly contentWidth: number
	readonly paneWidth: number
}) => {
	if (!epic) {
		return (
			<box flexDirection="column">
				<PaddedRow>
					<PlainLine text="Select an epic" fg={colors.muted} />
				</PaddedRow>
				<Divider width={paneWidth} />
				<Filler rows={8} prefix="epic-empty" />
			</box>
		)
	}

	const openIssues = epicIssues.filter((i) => i.state === "opened")
	const closedIssues = epicIssues.filter((i) => i.state !== "opened")
	const issuesWithBranch = epicIssues.filter((i) => i.primaryBranch?.trim())
	const titleWidth = Math.max(8, contentWidth - 14)
	const branchWidth = Math.max(6, Math.floor(contentWidth * 0.35))

	return (
		<box flexDirection="column">
			{/* Epic header */}
			<PaddedRow>
				<TextLine>
					<span fg={colors.count} attributes={TextAttributes.BOLD}>
						{trimCell(epic.title, contentWidth)}
					</span>
				</TextLine>
			</PaddedRow>
			<PaddedRow>
				<TextLine>
					<span fg={colors.muted}>{`${epic.groupPath}  #${epic.iid}`}</span>
				</TextLine>
			</PaddedRow>
			<PaddedRow>
				<TextLine>
					<span fg={colors.muted}>issues </span>
					<span fg={openIssues.length > 0 ? colors.status.review : colors.muted}>{`${openIssues.length} open`}</span>
					<span fg={colors.muted}>{`  ${closedIssues.length} closed`}</span>
					{issuesWithBranch.length > 0 ? (
						<>
							<span fg={colors.muted}>{`  `}</span>
							<span fg={colors.status.passing}>{`${issuesWithBranch.length} branched`}</span>
						</>
					) : null}
				</TextLine>
			</PaddedRow>

			<Divider width={paneWidth} />

			{/* Child issues list — heading shows focus state */}
			<PaddedRow>
				<TextLine>
					<span fg={issueFocus ? colors.accent : colors.muted} attributes={TextAttributes.BOLD}>
						{issueFocus ? "▸ Issues" : "  Issues"}
					</span>
					{issueFocus ? <span fg={colors.muted}>{" — ↑↓ navigate  esc back"}</span> : epicIssues.length > 0 ? <span fg={colors.muted}>{" — enter to browse"}</span> : null}
				</TextLine>
			</PaddedRow>

			{epicIssuesStatus === "loading" ? (
				<PaddedRow>
					<PlainLine text="  - Loading issues..." fg={colors.muted} />
				</PaddedRow>
			) : epicIssues.length === 0 ? (
				<PaddedRow>
					<PlainLine text="  - No child issues" fg={colors.muted} />
				</PaddedRow>
			) : (
				epicIssues.map((issue, index) => {
					const selected = issueFocus && index === selectedIssueIndex
					const issueKey = issue.references ?? `${issue.repository}#${issue.number}`
					const branch = issue.primaryBranch ?? primaryBranches[issueKey] ?? null
					const bg = selected ? colors.selectedBg : undefined
					const fg = selected ? colors.selectedText : colors.text
					const stateColor = issue.state === "opened" ? colors.status.review : colors.muted

					return (
						<TextLine key={issue.url} fg={fg} bg={bg}>
							<span fg={selected ? colors.selectedText : stateColor} attributes={TextAttributes.BOLD}>
								{fitCell(issue.state === "opened" ? "open" : "done", 5)}
							</span>
							<span fg={selected ? colors.selectedText : colors.muted}> </span>
							<span>{trimCell(`#${issue.number} ${issue.title}`, titleWidth)}</span>
							{branch ? (
								<span fg={selected ? colors.selectedText : colors.status.passing}>{`  ${trimCell(branch, branchWidth)}`}</span>
							) : (
								<span fg={selected ? colors.selectedText : colors.muted}>{`  ${trimCell("no branch", branchWidth)}`}</span>
							)}
						</TextLine>
					)
				})
			)}
		</box>
	)
}
