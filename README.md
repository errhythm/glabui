# glabui

Terminal UI for keeping up with your GitLab merge requests, workspace repos, issues, and epics.

`glabui` gives you one keyboard-driven place to review merge request details, inspect diffs, leave diff comments, manage labels, toggle draft state, merge, open GitLab pages in the browser, and move across multiple work surfaces without leaving the terminal.

<img width="1420" height="856" alt="image" src="https://github.com/user-attachments/assets/5e560a4a-5887-4baa-a6d4-e1f4f0410c70" />

## Install

Homebrew is the recommended install path on macOS and Linux. It installs a standalone `glabui` binary, so you do not need Bun or npm at runtime.

```bash
brew install errhythm/tap/glabui
```

Upgrade with:

```bash
brew upgrade glabui
```

Or install with npm:

```bash
npm install -g @errhythm/glabui
```

The npm package also installs a platform-specific binary package and does not require Bun.

Requirements:

- GitLab CLI installed and authenticated with `glab auth login`

Run it from anywhere:

```bash
glabui
```

## Local Development

Clone, install, and link:

```bash
git clone https://github.com/errhythm/glabui.git
cd glabui
bun install
bun link
```

With Nix flakes:

```bash
nix develop
bun install
bun run dev
```

## Configuration

- `GLABUI_PR_FETCH_LIMIT`: max merge requests fetched, defaults to `200`
- `GLABUI_WORKSPACE_ROOT`: override workspace discovery root

Example:

```bash
GLABUI_PR_FETCH_LIMIT=100 glabui
```

You can also copy `.env.example` to `.env` and edit the values locally.

glabui stores UI preferences in `config.json` under `GLABUI_CONFIG_DIR` when set,
otherwise under the platform config directory. On Linux this is normally
`~/.config/glabui/config.json`.

Example:

```json
{
	"theme": "system",
	"systemThemeAutoReload": true
}
```

`systemThemeAutoReload` defaults to `false`. Set it to `true` to let external
theme reload signals update the active system theme palette while ghui is
running.

## Keybindings

- `up` / `down`: move selection
- `k` / `j`: move selection
- `gg` / `G`: jump to first or last pull request
- `ctrl-u` / `ctrl-d`: page up or down
- `1-4`: switch sections
- `tab` / `shift-tab`: switch sections
- `ctrl-p` / `cmd-k`: open the command palette
- `/`: filter
- `enter`: expand details
- `esc`: return from expanded details, leave diff/comment mode, or close modal
- `r`: refresh
- `t`: open settings
- `d`: view stacked diff for all changed files
- `shift-r`: review or approve the selected pull request
- `up` / `down` / `pageup` / `pagedown`: move comment target while viewing a diff
- `enter`: open a commented diff line, or start a comment on an uncommented line
- `v`: start or clear a multi-line diff comment range
- `n` / `p`: jump between diff comment threads
- `f`: open the changed-files navigator while viewing a diff
- `left` / `right`: choose the deleted or added side while in split diff comment mode
- `[` / `]`: switch files while viewing or commenting on a diff
- `s`: toggle draft or ready-for-review state
- `m`: merge
- `x`: close with confirmation
- `l`: manage labels
- `o`: open PR in browser
- `y`: copy PR metadata
- `q`: quit

Review submission:

- Press `shift-r` to open the review modal.
- Use `j` / `k` or `up` / `down` to choose Comment, Approve, or Request changes.
- Press `enter` to move to the optional summary area.
- Press `enter` again to submit, or `shift-enter` to insert a newline.
- Press `esc` from the summary to return to action selection; press `esc` from action selection to cancel.
