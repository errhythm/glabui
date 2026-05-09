# Multi-surface glabui

## Why

glabui is currently merge-request centric. The target product is a broader GitLab workbench that also covers:

- workspace-level multi-repo operations
- issues and issue-driven branch workflows
- epics and epic-driven coordination flows

The UI must expose these capabilities without collapsing into a single overloaded MR screen.

## What we'd ship

- A top-level section model with four surfaces:
  - Merge Requests
  - Workspace
  - Issues
  - Epics
- Workspace section:
  - discover repos under the current path
  - show repo status/branch/project identity
  - switch one branch across all repos with preview and execution
- Issues section:
  - assigned/searchable issue lists
  - issue detail
  - primary branch persistence per issue
  - create/check out issue branches
  - create merge request from issue
- Epics section:
  - assigned/searchable epics list
  - optional epic label filter from settings
  - epic detail + epic issues
  - bulk checkout primary branches
  - bulk create merge requests
- Shared command palette, footer hints, and detail/list navigation across sections

## API / architecture mapping

- `src/App.tsx`
  - add top-level `AppSection`
  - render section-specific list/detail bodies inside existing shell
- `src/domain.ts`
  - add `AppSection`, `IssueItem`, `EpicItem`, `WorkspaceRepo`, `WorkspaceBranchSwitchPlan`, `PrimaryBranchMapping`, related enums
- `src/services/GitLabService.ts`
  - add issue/epic operations via `glab api`
  - add GraphQL epic loading
- `src/services/WorkspaceService.ts`
  - local repo discovery and git branch/status operations
- `src/services/SettingsService.ts`
  - persist primary branches, epic filters, epic mode (assigned/searchable)
- `src/ui/*`
  - add generic/simple list + detail panes for Workspace, Issues, Epics
- `src/appCommands.ts`
  - add section switching and section-specific actions
- `src/ui/FooterHints.tsx`
  - section-aware hints
- `src/keymap/*`
  - reuse existing list/detail flows, extend bindings for workspace/issue/epic actions

## Open questions

- How far to generalize the shared list/detail system versus duplicating per-surface components.
- How much of issue/epic comments should reuse MR comment flows versus stay read-only in v1.
- How much GitLab self-hosted compatibility variation for epic GraphQL needs fallback handling.

## Out of scope (for v1)

- editor workspace file generation
- boards / milestones as dedicated sections
- rich cross-linked dashboards
- nested split panes beyond the current list/detail/fullscreen structure

## Status

In progress
