import { TextAttributes } from "@opentui/core"
import { useState } from "react"
import { daysOpen } from "../date.js"
import type { EpicItem, IssueItem, LoadStatus, WorkspaceRepo } from "../domain.js"
import { colors, rowHoverBackground } from "./colors.js"
import { fitCell, MatchedCell, PlainLine, SectionTitle, TextLine } from "./primitives.js"

export interface SectionListItem {
	readonly id: string
	readonly title: string
	readonly subtitle: string
	readonly status: string
	readonly age?: string
	readonly accent?: string
}

export const workspaceRepoAsListItem = (repo: WorkspaceRepo): SectionListItem => ({
	id: repo.id,
	title: repo.name,
	subtitle: repo.projectPath ?? repo.path,
	status: repo.branch,
	age: repo.dirty ? `${repo.dirtyCount} dirty` : repo.ahead > 0 || repo.behind > 0 ? `${repo.ahead}↑ ${repo.behind}↓` : "clean",
	accent: repo.isGitLab ? colors.accent : colors.muted,
})

export const issueAsListItem = (issue: IssueItem): SectionListItem => ({
	id: issue.url,
	title: issue.title,
	subtitle: `${issue.repository} #${issue.number}`,
	status: issue.state,
	age: `${daysOpen(issue.createdAt)}d`,
	accent: issue.state === "opened" ? colors.status.review : colors.muted,
})

export const epicAsListItem = (epic: EpicItem): SectionListItem => ({
	id: epic.id,
	title: epic.title,
	subtitle: epic.groupPath,
	status: `#${epic.iid}`,
	age: `${epic.openIssueCount}/${epic.issueCount} open`,
	accent: colors.status.review,
})

export const SectionList = ({
	title,
	items,
	selectedId,
	status,
	error,
	filterText,
	showFilterBar,
	isFilterEditing,
	emptyText,
	onSelect,
}: {
	readonly title: string
	readonly items: readonly SectionListItem[]
	readonly selectedId: string | null
	readonly status: LoadStatus
	readonly error: string | null
	readonly filterText: string
	readonly showFilterBar: boolean
	readonly isFilterEditing: boolean
	readonly emptyText: string
	readonly onSelect: (id: string) => void
}) => {
	const [hoveredId, setHoveredId] = useState<string | null>(null)
	return (
		<box flexDirection="column">
			<SectionTitle title={title} />
			{showFilterBar ? (
				<TextLine>
					<span fg={colors.count}>/</span>
					<span fg={colors.muted}> </span>
					<span fg={isFilterEditing ? colors.text : colors.count}>{filterText.length > 0 ? filterText : "type to filter..."}</span>
				</TextLine>
			) : null}
			{status === "loading" && items.length === 0 ? <PlainLine text="- Loading..." fg={colors.muted} /> : null}
			{status === "error" ? <PlainLine text={`- ${error ?? "Could not load items."}`} fg={colors.error} /> : null}
			{status === "ready" && items.length === 0 ? <PlainLine text={`- ${emptyText}`} fg={colors.muted} /> : null}
			{items.map((item) => {
				const selected = item.id === selectedId
				const hovered = item.id === hoveredId
				const bg = selected ? colors.selectedBg : hovered ? rowHoverBackground() : undefined
				const fg = selected ? colors.selectedText : colors.text
				return (
					<TextLine
						key={item.id}
						fg={fg}
						bg={bg}
						onMouseDown={() => onSelect(item.id)}
						onMouseOver={() => setHoveredId(item.id)}
						onMouseOut={() => setHoveredId((current) => (current === item.id ? null : current))}
					>
						<span fg={item.accent ?? colors.count} attributes={TextAttributes.BOLD}>
							{fitCell(item.status, 10)}
						</span>
						<span> </span>
						<MatchedCell text={item.title} width={Math.max(8, 30)} query={filterText} />
						<span fg={selected ? colors.selectedText : colors.muted}> {fitCell(item.age ?? "", 10, "right")}</span>
					</TextLine>
				)
			})}
		</box>
	)
}
