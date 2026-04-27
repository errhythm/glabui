# ghui

Terminal UI for browsing and acting on your open GitHub pull requests across repositories.

## Install Locally

Requires `bun` and an authenticated GitHub CLI (`gh auth login`).

Clone, install, and link:

```bash
git clone https://github.com/kitlangton/ghui.git
cd ghui
bun install
bun link
```

Run from anywhere:

```bash
ghui
```

## Configuration

- `GHUI_AUTHOR`: author passed to `gh search prs`, defaults to `@me`
- `GHUI_PR_FETCH_LIMIT`: max PRs fetched, defaults to `200`

Example:

```bash
GHUI_AUTHOR=@me ghui
```

You can also copy `.env.example` to `.env` and edit the values locally.

## Keybindings

- `up` / `down`: move selection
- `k` / `j`: move selection
- `gg` / `G`: jump to first or last pull request
- `ctrl-u` / `ctrl-d`: page up or down
- `/`: filter
- `enter`: expand details
- `esc`: return from expanded details or close modal
- `r`: refresh
- `d`: toggle draft
- `l`: manage labels
- `o`: open PR in browser
- `y`: copy PR metadata
- `q`: quit
