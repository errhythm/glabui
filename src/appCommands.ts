import type { AppCommand } from "./commands.js"
import { defineCommand } from "./commands.js"
import type { AppSection, EpicItem, IssueItem, LoadStatus, PullRequestItem, PullRequestReviewEvent, WorkspaceRepo } from "./domain.js"
import type { DiffView, DiffWhitespaceMode, DiffWrapMode } from "./ui/diff.js"
import { type PullRequestView, viewEquals, viewLabel, viewMode } from "./pullRequestViews.js"
import { appSectionLabel, appSectionOrder } from "./appSections.js"

interface AppCommandActions {
	readonly openCommandPalette: () => void
	readonly refreshPullRequests: (message?: string, options?: { readonly resetTransientState?: boolean }) => void
	readonly openFilter: () => void
	readonly clearFilter: () => void
	readonly openSettingsModal: () => void
	readonly openRepositoryPicker: () => void
	readonly loadMorePullRequests: () => void
	readonly switchViewTo: (view: PullRequestView) => void
	readonly openDetails: () => void
	readonly closeDetails: () => void
	readonly openDiffView: () => void
	readonly closeDiffView: () => void
	readonly openCommentsView: () => void
	readonly closeCommentsView: () => void
	readonly openNewIssueCommentModal: () => void
	readonly openReplyToSelectedComment: () => void
	readonly openEditSelectedComment: () => void
	readonly openDeleteSelectedComment: () => void
	readonly reloadDiff: () => void
	readonly toggleDiffRenderView: () => void
	readonly toggleDiffWrapMode: () => void
	readonly toggleDiffWhitespaceMode: () => void
	readonly openChangedFilesModal: () => void
	readonly jumpDiffFile: (delta: 1 | -1) => void
	readonly openSelectedDiffComment: () => void
	readonly toggleDiffCommentRange: () => void
	readonly moveDiffCommentThread: (delta: 1 | -1) => void
	readonly openDiffCommentModal: () => void
	readonly openSubmitReviewModal: (initialEvent?: PullRequestReviewEvent) => void
	readonly openPullRequestStateModal: () => void
	readonly openLabelModal: () => void
	readonly openMergeModal: () => void
	readonly openCloseModal: () => void
	readonly openPullRequestInBrowser: () => void
	readonly openProjectInBrowser: () => void
	readonly copyPullRequestMetadata: () => void
	readonly quit: () => void
	readonly switchSection: (section: AppSection) => void
	readonly selectedSectionCommandOpenDetails: () => void
	readonly selectedSectionOpenInBrowser: () => void
	readonly selectedWorkspaceSwitchBranch: () => void
	readonly selectedIssueSetPrimaryBranch: () => void
	readonly selectedIssueCreateBranch: () => void
	readonly selectedIssueCreateMergeRequest: () => void
	readonly selectedEpicCheckoutBranches: () => void
	readonly selectedEpicCreateMergeRequests: () => void
}

interface BuildAppCommandsInput {
	readonly pullRequestStatus: LoadStatus
	readonly filterQuery: string
	readonly filterMode: boolean
	readonly selectedRepository: string | null
	readonly activeViews: readonly PullRequestView[]
	readonly activeView: PullRequestView
	readonly loadedPullRequestCount: number
	readonly hasMorePullRequests: boolean
	readonly isLoadingMorePullRequests: boolean
	readonly selectedPullRequest: PullRequestItem | null
	readonly detailFullView: boolean
	readonly diffFullView: boolean
	readonly commentsViewActive: boolean
	readonly hasSelectedComment: boolean
	readonly canEditSelectedComment: boolean
	readonly diffReady: boolean
	readonly effectiveDiffRenderView: DiffView
	readonly diffWrapMode: DiffWrapMode
	readonly diffWhitespaceMode: DiffWhitespaceMode
	readonly readyDiffFileCount: number
	readonly diffFileIndex: number
	readonly diffRangeActive: boolean
	readonly selectedDiffCommentAnchorLabel: string | null
	readonly selectedDiffCommentThreadCount: number
	readonly hasDiffCommentThreads: boolean
	readonly actions: AppCommandActions
	readonly activeSection: AppSection
	readonly selectedWorkspaceRepo: WorkspaceRepo | null
	readonly selectedIssue: IssueItem | null
	readonly selectedEpic: EpicItem | null
}

export const buildAppCommands = ({
	pullRequestStatus,
	filterQuery,
	filterMode,
	selectedRepository,
	activeViews,
	activeView,
	loadedPullRequestCount,
	hasMorePullRequests,
	isLoadingMorePullRequests,
	selectedPullRequest,
	detailFullView,
	diffFullView,
	commentsViewActive,
	hasSelectedComment,
	canEditSelectedComment,
	diffReady,
	effectiveDiffRenderView,
	diffWrapMode,
	diffWhitespaceMode,
	readyDiffFileCount,
	diffFileIndex,
	diffRangeActive,
	selectedDiffCommentAnchorLabel,
	selectedDiffCommentThreadCount,
	hasDiffCommentThreads,
	actions,
	activeSection,
	selectedWorkspaceRepo,
	selectedIssue,
	selectedEpic,
}: BuildAppCommandsInput): readonly AppCommand[] => {
	const selectedPullRequestLabel = selectedPullRequest ? `#${selectedPullRequest.number} ${selectedPullRequest.repository}` : "No merge request selected"
	const noPullRequestReason = selectedPullRequest ? null : "Select a merge request first."
	const noOpenPullRequestReason = selectedPullRequest?.state === "open" ? null : selectedPullRequest ? "Merge request is not open." : noPullRequestReason
	const diffReadyReason = selectedPullRequest ? (diffReady ? null : "Load the diff before running this command.") : noPullRequestReason
	const diffOpenReadyReason = diffFullView ? diffReadyReason : "Open a diff first."
	const selectedDiffLineReason = diffFullView && diffReady ? (selectedDiffCommentAnchorLabel ? null : "No diff line selected.") : diffOpenReadyReason
	const diffThreadReason = diffFullView && diffReady ? (hasDiffCommentThreads ? null : "No diff comments loaded.") : diffOpenReadyReason
	const changedFilesReason = diffFullView && diffReady ? (readyDiffFileCount > 0 ? null : "No changed files loaded.") : diffOpenReadyReason
	const selectedCommentReason = selectedPullRequest ? (commentsViewActive ? (hasSelectedComment ? null : "No comment selected.") : "Open comments first.") : noPullRequestReason
	const ownCommentReason = selectedCommentReason ?? (canEditSelectedComment ? null : "Only your own (synced) comments can be edited or deleted.")
	const loadMoreDisabledReason = isLoadingMorePullRequests ? "Already loading more merge requests." : hasMorePullRequests ? null : "No more merge requests loaded by this view."

	const forSelected = (command: Omit<AppCommand, "subtitle" | "disabledReason"> & { readonly requireOpen?: boolean }): AppCommand => {
		const { requireOpen, ...rest } = command
		return defineCommand({
			...rest,
			subtitle: selectedPullRequestLabel,
			disabledReason: requireOpen ? noOpenPullRequestReason : noPullRequestReason,
		})
	}

	return [
		...appSectionOrder.map((section, index) =>
			defineCommand({
				id: `section.${section}`,
				title: `Open ${appSectionLabel(section)}`,
				scope: "View",
				shortcut: String(index + 1),
				disabledReason: activeSection === section ? `Already showing ${appSectionLabel(section)}.` : null,
				run: () => actions.switchSection(section),
			}),
		),
		defineCommand({
			id: "command.open",
			title: "Open command palette",
			scope: "Global",
			subtitle: "Search every available route through glabui",
			shortcut: "ctrl-p/cmd-k/?",
			keywords: ["palette", "commands", "deck", "help", "keys", "keyboard", "shortcuts"],
			run: actions.openCommandPalette,
		}),
		defineCommand({
			id: "pull.refresh",
			title:
				activeSection === "merge-requests"
					? pullRequestStatus === "error"
						? "Retry loading merge requests"
						: "Refresh merge requests"
					: `Refresh ${appSectionLabel(activeSection)}`,
			scope: "Global",
			subtitle: "Fetch the latest queue from GitLab",
			shortcut: "r",
			keywords: ["reload", "sync"],
			run: () => actions.refreshPullRequests("Refreshed", { resetTransientState: true }),
		}),
		defineCommand({
			id: "filter.open",
			title: `Filter ${appSectionLabel(activeSection)}`,
			scope: "Global",
			subtitle: "Search the visible queue",
			shortcut: "/",
			keywords: ["search"],
			run: actions.openFilter,
		}),
		defineCommand({
			id: "filter.clear",
			title: `Clear ${appSectionLabel(activeSection)} filter`,
			scope: "Global",
			subtitle: "Show every merge request in the current queue",
			shortcut: "esc",
			disabledReason: filterQuery.length > 0 || filterMode ? null : "No filter is active.",
			run: actions.clearFilter,
		}),
		defineCommand({
			id: "settings.open",
			title: "Open settings",
			scope: "Global",
			subtitle: "Theme, workspace root, epic options, and other preferences",
			shortcut: "t",
			keywords: ["settings", "colors", "appearance", "preferences"],
			run: actions.openSettingsModal,
		}),
		defineCommand({
			id: "repository.open",
			title: "Switch repository...",
			scope: "View",
			subtitle: selectedRepository ? `Current repository: ${selectedRepository}` : "Enter owner/name or a GitLab URL",
			keywords: ["repo", "repository", "owner", "gitlab", "switch"],
			run: actions.openRepositoryPicker,
		}),
		...activeViews.map((view) =>
			defineCommand({
				id: view._tag === "Repository" ? "view.repository" : `view.${view.mode}`,
				title: `Show ${viewLabel(view)} view`,
				scope: "View" as const,
				subtitle: viewEquals(view, activeView) ? "Already showing this view" : "Switch merge request view",
				keywords: [viewMode(view), viewLabel(view), "queue", "view"],
				disabledReason: viewEquals(view, activeView) ? "Already showing this view." : null,
				run: () => actions.switchViewTo(view),
			}),
		),
		defineCommand({
			id: "pull.load-more",
			title: "Load more merge requests",
			scope: "Navigation",
			subtitle: `${loadedPullRequestCount} loaded`,
			disabledReason: loadMoreDisabledReason,
			keywords: ["next page", "pagination", "more"],
			run: actions.loadMorePullRequests,
		}),
		forSelected({
			id: "detail.open",
			title: "Open merge request details",
			scope: "Pull request",
			shortcut: "enter",
			run: actions.openDetails,
		}),
		defineCommand({
			id: "detail.close",
			title: "Close details view",
			scope: "Pull request",
			subtitle: "Return to the queue",
			shortcut: "esc",
			disabledReason: detailFullView ? null : "Details view is not open.",
			run: actions.closeDetails,
		}),
		forSelected({
			id: "diff.open",
			title: "Open diff",
			scope: "Diff",
			shortcut: "d",
			keywords: ["files", "patch"],
			run: actions.openDiffView,
		}),
		forSelected({
			id: "comments.open",
			title: "Open comments",
			scope: "Comments",
			shortcut: "c",
			keywords: ["conversation", "discussion", "review"],
			run: actions.openCommentsView,
		}),
		forSelected({
			id: "comments.new",
			title: "New comment",
			scope: "Comments",
			shortcut: "a",
			keywords: ["add", "post", "issue comment"],
			run: actions.openNewIssueCommentModal,
		}),
		defineCommand({
			id: "comments.reply",
			title: "Reply to comment",
			scope: "Comments",
			subtitle: selectedPullRequestLabel,
			shortcut: "shift-r",
			disabledReason: selectedCommentReason,
			keywords: ["respond", "thread"],
			run: actions.openReplyToSelectedComment,
		}),
		defineCommand({
			id: "comments.edit",
			title: "Edit comment",
			scope: "Comments",
			subtitle: selectedPullRequestLabel,
			shortcut: "e",
			disabledReason: ownCommentReason,
			keywords: ["update", "modify", "rewrite"],
			run: actions.openEditSelectedComment,
		}),
		defineCommand({
			id: "comments.delete",
			title: "Delete comment",
			scope: "Comments",
			subtitle: selectedPullRequestLabel,
			shortcut: "x",
			disabledReason: ownCommentReason,
			keywords: ["remove", "destroy"],
			run: actions.openDeleteSelectedComment,
		}),
		defineCommand({
			id: "diff.close",
			title: "Close diff view",
			scope: "Diff",
			subtitle: "Return to the queue or detail view",
			shortcut: "esc",
			disabledReason: diffFullView ? null : "Diff view is not open.",
			run: actions.closeDiffView,
		}),
		defineCommand({
			id: "diff.reload",
			title: "Reload diff",
			scope: "Diff",
			subtitle: selectedPullRequestLabel,
			shortcut: "r",
			disabledReason: diffFullView && selectedPullRequest ? null : "Open a merge request diff first.",
			keywords: ["refresh", "comments"],
			run: actions.reloadDiff,
		}),
		defineCommand({
			id: "diff.toggle-view",
			title: "Toggle diff split/unified view",
			scope: "Diff",
			subtitle: effectiveDiffRenderView === "split" ? "Switch to unified view" : "Switch to split view",
			shortcut: "shift-v",
			disabledReason: diffFullView ? null : "Open a diff first.",
			run: actions.toggleDiffRenderView,
		}),
		defineCommand({
			id: "diff.toggle-wrap",
			title: "Toggle diff word wrap",
			scope: "Diff",
			subtitle: diffWrapMode === "none" ? "Wrap long diff lines" : "Keep diff lines unwrapped",
			shortcut: "w",
			disabledReason: diffFullView ? null : "Open a diff first.",
			run: actions.toggleDiffWrapMode,
		}),
		defineCommand({
			id: "diff.toggle-whitespace",
			title: diffWhitespaceMode === "ignore" ? "Show whitespace changes" : "Ignore whitespace changes",
			scope: "Diff",
			subtitle: diffWhitespaceMode === "ignore" ? "Display the original GitLab patch" : "Hide whitespace-only line changes",
			disabledReason: diffFullView ? null : "Open a diff first.",
			keywords: ["whitespace", "spacing", "ignore", "show"],
			run: actions.toggleDiffWhitespaceMode,
		}),
		defineCommand({
			id: "diff.changed-files",
			title: "Open changed files navigator",
			scope: "Diff",
			subtitle: readyDiffFileCount > 0 ? `${readyDiffFileCount} changed files` : "No diff files loaded",
			shortcut: "f",
			disabledReason: changedFilesReason,
			keywords: ["files", "navigator", "search"],
			run: actions.openChangedFilesModal,
		}),
		defineCommand({
			id: "diff.next-file",
			title: "Next diff file",
			scope: "Diff",
			subtitle: readyDiffFileCount > 0 ? `${diffFileIndex + 1}/${readyDiffFileCount}` : "No diff files loaded",
			shortcut: "]",
			disabledReason: changedFilesReason,
			run: () => actions.jumpDiffFile(1),
		}),
		defineCommand({
			id: "diff.previous-file",
			title: "Previous diff file",
			scope: "Diff",
			subtitle: readyDiffFileCount > 0 ? `${diffFileIndex + 1}/${readyDiffFileCount}` : "No diff files loaded",
			shortcut: "[",
			disabledReason: changedFilesReason,
			run: () => actions.jumpDiffFile(-1),
		}),
		defineCommand({
			id: "diff.open-comment-target",
			title: selectedDiffCommentThreadCount > 0 ? "Open selected diff thread" : "Comment on selected diff line",
			scope: "Diff",
			subtitle: selectedDiffCommentAnchorLabel ?? "No diff line selected",
			shortcut: "enter",
			disabledReason: selectedDiffLineReason,
			keywords: ["review", "comment", "thread", "line"],
			run: actions.openSelectedDiffComment,
		}),
		defineCommand({
			id: "diff.toggle-range",
			title: diffRangeActive ? "Clear diff comment range" : "Start diff comment range",
			scope: "Diff",
			subtitle: selectedDiffCommentAnchorLabel ?? "No diff line selected",
			shortcut: "v",
			disabledReason: selectedDiffLineReason,
			keywords: ["review", "comment", "range", "visual"],
			run: actions.toggleDiffCommentRange,
		}),
		defineCommand({
			id: "diff.next-thread",
			title: "Next diff thread",
			scope: "Diff",
			subtitle: hasDiffCommentThreads ? "Jump to the next commented line" : "No diff comments loaded",
			shortcut: "n",
			disabledReason: diffThreadReason,
			keywords: ["review", "comment", "thread"],
			run: () => actions.moveDiffCommentThread(1),
		}),
		defineCommand({
			id: "diff.previous-thread",
			title: "Previous diff thread",
			scope: "Diff",
			subtitle: hasDiffCommentThreads ? "Jump to the previous commented line" : "No diff comments loaded",
			shortcut: "p",
			disabledReason: diffThreadReason,
			keywords: ["review", "comment", "thread"],
			run: () => actions.moveDiffCommentThread(-1),
		}),
		defineCommand({
			id: "diff.add-comment",
			title: "Add comment on selected diff line",
			scope: "Diff",
			subtitle: selectedDiffCommentAnchorLabel ?? "No diff line selected",
			disabledReason: selectedDiffLineReason,
			keywords: ["review", "reply"],
			run: actions.openDiffCommentModal,
		}),
		forSelected({
			id: "pull.submit-review",
			title: "Review merge request",
			scope: "Pull request",
			shortcut: "shift-r",
			requireOpen: true,
			keywords: ["review", "approve", "request changes", "comment"],
			run: () => actions.openSubmitReviewModal("APPROVE"),
		}),
		forSelected({
			id: "pull.toggle-draft",
			title: selectedPullRequest?.reviewStatus === "draft" ? "Mark ready for review" : "Convert to draft",
			scope: "Pull request",
			shortcut: "s",
			requireOpen: true,
			keywords: ["state", "ready"],
			run: actions.openPullRequestStateModal,
		}),
		forSelected({
			id: "pull.labels",
			title: "Manage labels",
			scope: "Pull request",
			shortcut: "l",
			run: actions.openLabelModal,
		}),
		forSelected({
			id: "pull.merge",
			title: "Merge merge request",
			scope: "Pull request",
			shortcut: "m",
			keywords: ["auto merge", "squash"],
			run: actions.openMergeModal,
		}),
		forSelected({
			id: "pull.close",
			title: "Close merge request",
			scope: "Pull request",
			shortcut: "x",
			requireOpen: true,
			run: actions.openCloseModal,
		}),
		forSelected({
			id: "pull.open-browser",
			title: "Open merge request in browser",
			scope: "Pull request",
			shortcut: "o",
			keywords: ["gitlab", "web", "url"],
			run: actions.openPullRequestInBrowser,
		}),
		forSelected({
			id: "pull.open-project",
			title: "Open project in browser",
			scope: "Pull request",
			shortcut: "O",
			keywords: ["gitlab", "web", "project", "repo"],
			run: actions.openProjectInBrowser,
		}),
		forSelected({
			id: "pull.copy-metadata",
			title: "Copy merge request metadata",
			scope: "Pull request",
			shortcut: "y",
			keywords: ["clipboard", "url", "title"],
			run: actions.copyPullRequestMetadata,
		}),
		defineCommand({
			id: "workspace.switch-branch",
			title: "Switch branch across workspace",
			scope: "Workspace",
			subtitle: selectedWorkspaceRepo ? selectedWorkspaceRepo.name : "No workspace repo selected",
			disabledReason: selectedWorkspaceRepo ? null : "Select a workspace repository first.",
			shortcut: "b",
			run: actions.selectedWorkspaceSwitchBranch,
		}),
		defineCommand({
			id: "workspace.open-browser",
			title: "Open workspace project in browser",
			scope: "Workspace",
			subtitle: selectedWorkspaceRepo ? selectedWorkspaceRepo.name : "No workspace repo selected",
			disabledReason: selectedWorkspaceRepo ? null : "Select a workspace repository first.",
			shortcut: "o",
			run: actions.selectedSectionOpenInBrowser,
		}),
		defineCommand({
			id: "issues.open-detail",
			title: "Open issue details",
			scope: "Issues",
			subtitle: selectedIssue ? `#${selectedIssue.number} ${selectedIssue.repository}` : "No issue selected",
			disabledReason: selectedIssue ? null : "Select an issue first.",
			shortcut: "enter",
			run: actions.selectedSectionCommandOpenDetails,
		}),
		defineCommand({
			id: "issues.primary-branch",
			title: "Set issue primary branch",
			scope: "Issues",
			subtitle: selectedIssue ? `#${selectedIssue.number} ${selectedIssue.repository}` : "No issue selected",
			disabledReason: selectedIssue ? null : "Select an issue first.",
			shortcut: "b",
			run: actions.selectedIssueSetPrimaryBranch,
		}),
		defineCommand({
			id: "issues.create-branch",
			title: "Create branch from issue",
			scope: "Issues",
			subtitle: selectedIssue ? `#${selectedIssue.number} ${selectedIssue.repository}` : "No issue selected",
			disabledReason: selectedIssue ? null : "Select an issue first.",
			shortcut: "n",
			run: actions.selectedIssueCreateBranch,
		}),
		defineCommand({
			id: "issues.create-mr",
			title: "Create merge request from issue",
			scope: "Issues",
			subtitle: selectedIssue ? `#${selectedIssue.number} ${selectedIssue.repository}` : "No issue selected",
			disabledReason: selectedIssue ? null : "Select an issue first.",
			shortcut: "m",
			run: actions.selectedIssueCreateMergeRequest,
		}),
		defineCommand({
			id: "issues.open-browser",
			title: "Open issue in browser",
			scope: "Issues",
			subtitle: selectedIssue ? `#${selectedIssue.number} ${selectedIssue.repository}` : "No issue selected",
			disabledReason: selectedIssue ? null : "Select an issue first.",
			shortcut: "o",
			run: actions.selectedSectionOpenInBrowser,
		}),
		defineCommand({
			id: "epics.open-detail",
			title: "Open epic details",
			scope: "Epics",
			subtitle: selectedEpic ? `#${selectedEpic.iid} ${selectedEpic.groupPath}` : "No epic selected",
			disabledReason: selectedEpic ? null : "Select an epic first.",
			shortcut: "enter",
			run: actions.selectedSectionCommandOpenDetails,
		}),
		defineCommand({
			id: "epics.checkout-branches",
			title: "Checkout epic primary branches",
			scope: "Epics",
			subtitle: selectedEpic ? `#${selectedEpic.iid} ${selectedEpic.groupPath}` : "No epic selected",
			disabledReason: selectedEpic ? null : "Select an epic first.",
			shortcut: "b",
			run: actions.selectedEpicCheckoutBranches,
		}),
		defineCommand({
			id: "epics.bulk-mr",
			title: "Create merge requests for epic issues",
			scope: "Epics",
			subtitle: selectedEpic ? `#${selectedEpic.iid} ${selectedEpic.groupPath}` : "No epic selected",
			disabledReason: selectedEpic ? null : "Select an epic first.",
			shortcut: "m",
			run: actions.selectedEpicCreateMergeRequests,
		}),
		defineCommand({
			id: "epics.open-browser",
			title: "Open epic in browser",
			scope: "Epics",
			subtitle: selectedEpic ? `#${selectedEpic.iid} ${selectedEpic.groupPath}` : "No epic selected",
			disabledReason: selectedEpic ? null : "Select an epic first.",
			shortcut: "o",
			run: actions.selectedSectionOpenInBrowser,
		}),
		defineCommand({
			id: "app.quit",
			title: "Quit glabui",
			scope: "System",
			subtitle: "Leave the terminal UI",
			shortcut: "q",
			keywords: ["exit"],
			run: actions.quit,
		}),
	]
}
