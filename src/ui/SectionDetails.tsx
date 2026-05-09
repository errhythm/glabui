import { TextAttributes } from "@opentui/core"
import type { EpicItem, IssueItem, WorkspaceBranchSwitchResult, WorkspaceRepo } from "../domain.js"
import { formatRelativeDate } from "../date.js"
import { colors } from "./colors.js"
import { bodyPreview } from "./DetailsPane.js"
import { Divider, Filler, PaddedRow, PlainLine, TextLine, trimCell } from "./primitives.js"

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

export const EpicDetails = ({ epic, contentWidth, paneWidth }: { readonly epic: EpicItem | null; readonly contentWidth: number; readonly paneWidth: number }) => {
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
	return (
		<box flexDirection="column">
			<PaddedRow>
				<TextLine>
					<span fg={colors.count}>{trimCell(epic.title, contentWidth)}</span>
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
					<span fg={colors.text}>{`${epic.openIssueCount} open / ${epic.closedIssueCount} closed / ${epic.issueCount} total`}</span>
				</TextLine>
			</PaddedRow>
			<Divider width={paneWidth} />
			{renderBodyPreview(epic.body, contentWidth, 12)}
		</box>
	)
}
