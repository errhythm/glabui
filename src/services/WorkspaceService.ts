import { readdirSync } from "node:fs"
import { basename, dirname, join, sep } from "node:path"
import { Context, Effect, Layer } from "effect"
import type { WorkspaceBranchSwitchResult, WorkspaceRepo } from "../domain.js"
import { CommandRunner } from "./CommandRunner.js"

export interface SwitchWorkspaceBranchInput {
	readonly rootPath: string
	readonly branch: string
	readonly exact: boolean
	readonly createIfMissing: boolean
	readonly autoStash: boolean
	readonly fetch: boolean
	readonly pull: boolean
	readonly dryRun: boolean
}

const findRepos = (cwd: string, depth = 4) => {
	const repos: string[] = []
	const walk = (dir: string, currentDepth: number) => {
		if (currentDepth > depth) return
		let entries: ReturnType<typeof readdirSync>
		try {
			entries = readdirSync(dir, { withFileTypes: true })
		} catch {
			return
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue
			const full = join(dir, entry.name)
			if (entry.name === ".git") {
				repos.push(dirname(full))
				return
			}
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue
			walk(full, currentDepth + 1)
		}
	}
	walk(cwd, 1)
	return repos.filter((repo) => !repos.some((other) => other !== repo && repo.startsWith(other + sep)))
}

const parseGitLabProjectPath = (url: string | null) => {
	if (!url) return null
	if (!/gitlab/i.test(url)) return null
	return url
		.replace(/^git@[^:]+:/, "")
		.replace(/^https?:\/\/[^/]+\//, "")
		.replace(/\.git$/, "")
}

const parseProjectUrl = (remoteUrl: string | null) => {
	if (!remoteUrl || !/gitlab/i.test(remoteUrl)) return null
	const normalized = remoteUrl.replace(/^git@([^:]+):/, "https://$1/").replace(/\.git$/, "")
	return normalized
}

const branchCandidatesFromOutput = (stdout: string) =>
	stdout
		.split("\n")
		.map((line) => line.replace(/^\*\s*/, "").trim())
		.filter(Boolean)

export class WorkspaceService extends Context.Service<
	WorkspaceService,
	{
		readonly discoverRepos: (rootPath: string) => Effect.Effect<readonly WorkspaceRepo[]>
		readonly listBranches: (repoPath: string, query?: string) => Effect.Effect<readonly string[]>
		readonly switchBranchAcrossWorkspace: (input: SwitchWorkspaceBranchInput) => Effect.Effect<readonly WorkspaceBranchSwitchResult[]>
	}
>()("glabui/WorkspaceService") {
	static readonly layer = Layer.effect(
		WorkspaceService,
		Effect.gen(function* () {
			const runner = yield* CommandRunner

			const safeRun = (command: string, args: readonly string[], cwd: string) => runner.run(command, args, { cwd }).pipe(Effect.option)

			const getCurrentBranch = (repoPath: string) =>
				Effect.map(safeRun("git", ["rev-parse", "--abbrev-ref", "HEAD"], repoPath), (result) => (result._tag === "Some" ? result.value.stdout.trim() || "unknown" : "unknown"))

			const getRemoteUrl = (repoPath: string) =>
				Effect.map(safeRun("git", ["remote", "get-url", "origin"], repoPath), (result) => (result._tag === "Some" ? result.value.stdout.trim() || null : null))

			const getDefaultBranch = (repoPath: string) =>
				Effect.map(safeRun("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], repoPath), (result) => {
					if (result._tag !== "Some") return "main"
					return result.value.stdout.trim().replace(/^refs\/remotes\/origin\//, "") || "main"
				})

			const getRepoStatus = (repoPath: string) =>
				Effect.map(safeRun("git", ["status", "--porcelain"], repoPath), (result) => {
					if (result._tag !== "Some") return { dirty: false, dirtyCount: 0 }
					const lines = result.value.stdout.trim().split("\n").filter(Boolean)
					return { dirty: lines.length > 0, dirtyCount: lines.length }
				})

			const getAheadBehind = (repoPath: string) =>
				Effect.map(safeRun("git", ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], repoPath), (result) => {
					if (result._tag !== "Some") return { ahead: 0, behind: 0 }
					const counts = result.value.stdout.trim().split("\t")
					const behind = Number.parseInt(counts[0] ?? "0", 10) || 0
					const ahead = Number.parseInt(counts[1] ?? "0", 10) || 0
					return { ahead, behind }
				})

			const discoverRepos = (rootPath: string) =>
				Effect.forEach(findRepos(rootPath), (repoPath) =>
					Effect.all({
						branch: getCurrentBranch(repoPath),
						defaultBranch: getDefaultBranch(repoPath),
						remoteUrl: getRemoteUrl(repoPath),
						status: getRepoStatus(repoPath),
						aheadBehind: getAheadBehind(repoPath),
					}).pipe(
						Effect.map(({ branch, defaultBranch, remoteUrl, status, aheadBehind }) => {
							const projectPath = parseGitLabProjectPath(remoteUrl)
							return {
								id: repoPath,
								name: basename(repoPath),
								path: repoPath,
								branch,
								defaultBranch,
								remoteUrl,
								projectPath,
								projectUrl: parseProjectUrl(remoteUrl),
								isGitLab: projectPath !== null,
								dirty: status.dirty,
								dirtyCount: status.dirtyCount,
								ahead: aheadBehind.ahead,
								behind: aheadBehind.behind,
							} satisfies WorkspaceRepo
						}),
					),
				)

			const listBranches = (repoPath: string, query = ""): Effect.Effect<readonly string[]> =>
				runner.run("git", ["branch", "--all", "--list", `*${query}*`], { cwd: repoPath }).pipe(
					Effect.map((result) => [...new Set(branchCandidatesFromOutput(result.stdout).map((name) => name.replace(/^remotes\/origin\//, "")))].sort()),
					Effect.catch(() => Effect.succeed([])),
				)

			const switchBranchAcrossWorkspace = (input: SwitchWorkspaceBranchInput): Effect.Effect<readonly WorkspaceBranchSwitchResult[]> =>
				Effect.gen(function* () {
					const repos = yield* discoverRepos(input.rootPath)
					return yield* Effect.forEach(
						repos,
						(repo) =>
							Effect.gen(function* () {
								let nextBranch = input.branch
								if (!input.exact) {
									const candidates = yield* listBranches(repo.path, input.branch).pipe(Effect.catch(() => Effect.succeed([])))
									const exactCandidate = candidates.find((candidate: string) => candidate === input.branch)
									nextBranch = exactCandidate ?? candidates[0] ?? input.branch
								}
								if (input.dryRun) {
									return {
										repoId: repo.id,
										repoName: repo.name,
										previousBranch: repo.branch,
										nextBranch,
										status: repo.branch === nextBranch ? "already-on" : "switched",
										message: repo.branch === nextBranch ? "already on branch" : "dry run",
										stashed: false,
									} satisfies WorkspaceBranchSwitchResult
								}

								let stashed = false
								if (input.autoStash && repo.dirty) {
									yield* runner.run("git", ["stash", "push", "--include-untracked", "-m", "glabui auto-stash"], { cwd: repo.path }).pipe(Effect.catch(() => Effect.void))
									stashed = true
								}
								if (input.fetch) {
									yield* runner.run("git", ["fetch", "--all", "--prune"], { cwd: repo.path }).pipe(Effect.catch(() => Effect.void))
								}
								if (repo.branch !== nextBranch) {
									const switched = yield* runner.run("git", ["switch", nextBranch], { cwd: repo.path }).pipe(
										Effect.as(true),
										Effect.catch(() =>
											input.createIfMissing
												? runner.run("git", ["switch", "-c", nextBranch], { cwd: repo.path }).pipe(
														Effect.as(true),
														Effect.catch(() => Effect.succeed(false)),
													)
												: Effect.succeed(false),
										),
									)
									if (!switched) {
										return {
											repoId: repo.id,
											repoName: repo.name,
											previousBranch: repo.branch,
											nextBranch,
											status: "skipped",
											message: "branch not found",
											stashed,
										} satisfies WorkspaceBranchSwitchResult
									}
								}
								if (input.pull) {
									yield* runner.run("git", ["pull"], { cwd: repo.path }).pipe(Effect.catch(() => Effect.void))
								}
								if (stashed) {
									yield* runner.run("git", ["stash", "pop"], { cwd: repo.path }).pipe(Effect.catch(() => Effect.void))
								}
								return {
									repoId: repo.id,
									repoName: repo.name,
									previousBranch: repo.branch,
									nextBranch,
									status: repo.branch === nextBranch ? "already-on" : "switched",
									message: repo.branch === nextBranch ? "already on branch" : "switched",
									stashed,
								} satisfies WorkspaceBranchSwitchResult
							}),
						{ concurrency: "unbounded" },
					)
				})

			return WorkspaceService.of({ discoverRepos, listBranches, switchBranchAcrossWorkspace })
		}),
	)
}
