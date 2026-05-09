import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { homedir } from "node:os"
import { Context, Effect, Layer } from "effect"
import type { EpicListMode } from "../domain.js"

const configDirectory = () => {
	if (process.env.GLABUI_CONFIG_DIR) return process.env.GLABUI_CONFIG_DIR
	if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "glabui")
	if (process.platform === "win32" && process.env.APPDATA) return join(process.env.APPDATA, "glabui")
	return join(homedir(), ".config", "glabui")
}

const defaultSettingsPath = () => join(configDirectory(), "config.json")

export interface AppSettings {
	readonly primaryBranches: Readonly<Record<string, string>>
	readonly epicMode: EpicListMode
	readonly epicLabelFilter: string | null
	readonly workspaceRoot: string | null
	readonly systemThemeAutoReload: boolean
}

const defaultSettings = (): AppSettings => ({
	primaryBranches: {},
	epicMode: "assigned",
	epicLabelFilter: null,
	workspaceRoot: null,
	systemThemeAutoReload: false,
})

const normalizeSettings = (value: unknown): AppSettings => {
	try {
		const decoded = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
		const primaryBranchesSource = typeof decoded.primaryBranches === "object" && decoded.primaryBranches !== null ? (decoded.primaryBranches as Record<string, unknown>) : {}
		return {
			primaryBranches: Object.fromEntries(Object.entries(primaryBranchesSource).flatMap(([key, branch]) => (typeof branch === "string" ? [[key, branch]] : []))),
			epicMode: decoded.epicMode === "searchable" ? "searchable" : "assigned",
			epicLabelFilter: typeof decoded.epicLabelFilter === "string" && decoded.epicLabelFilter.trim() ? decoded.epicLabelFilter.trim() : null,
			workspaceRoot: typeof decoded.workspaceRoot === "string" && decoded.workspaceRoot.trim() ? decoded.workspaceRoot.trim() : null,
			systemThemeAutoReload: typeof decoded.systemThemeAutoReload === "boolean" ? decoded.systemThemeAutoReload : false,
		}
	} catch {
		return defaultSettings()
	}
}

export class SettingsService extends Context.Service<
	SettingsService,
	{
		readonly load: () => Effect.Effect<AppSettings>
		readonly save: (settings: AppSettings) => Effect.Effect<void>
		readonly getPrimaryBranch: (issueKey: string) => Effect.Effect<string | null>
		readonly setPrimaryBranch: (issueKey: string, branch: string | null) => Effect.Effect<void>
		readonly setEpicMode: (mode: EpicListMode) => Effect.Effect<void>
		readonly setEpicLabelFilter: (label: string | null) => Effect.Effect<void>
		readonly setWorkspaceRoot: (root: string | null) => Effect.Effect<void>
		readonly setSystemThemeAutoReload: (enabled: boolean) => Effect.Effect<void>
	}
>()("glabui/SettingsService") {
	static readonly layerFromPath = (filename = defaultSettingsPath()) =>
		Layer.effect(
			SettingsService,
			Effect.gen(function* () {
				const load = (): Effect.Effect<AppSettings> =>
					Effect.tryPromise(async () => {
						const raw = await readFile(filename, "utf8").catch(() => null)
						if (!raw) return defaultSettings()
						return normalizeSettings(JSON.parse(raw))
					}).pipe(Effect.catch(() => Effect.succeed(defaultSettings())))

				const save = (settings: AppSettings): Effect.Effect<void> =>
					Effect.tryPromise(async () => {
						const existingRaw = await readFile(filename, "utf8").catch(() => null)
						const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {}
						await mkdir(dirname(filename), { recursive: true })
						await writeFile(
							filename,
							JSON.stringify(
								{
									...existing,
									primaryBranches: settings.primaryBranches,
									epicMode: settings.epicMode,
									epicLabelFilter: settings.epicLabelFilter,
									workspaceRoot: settings.workspaceRoot,
									systemThemeAutoReload: settings.systemThemeAutoReload,
								},
								null,
								2,
							) + "\n",
						)
					}).pipe(Effect.catch(() => Effect.void))

				const getPrimaryBranch = (issueKey: string) => Effect.map(load(), (settings) => settings.primaryBranches[issueKey] ?? null)

				const setPrimaryBranch = (issueKey: string, branch: string | null) =>
					Effect.gen(function* () {
						const settings = yield* load()
						const next = { ...settings.primaryBranches }
						if (branch?.trim()) next[issueKey] = branch.trim()
						else delete next[issueKey]
						yield* save({ ...settings, primaryBranches: next })
					})

				const setEpicMode = (mode: EpicListMode) =>
					Effect.gen(function* () {
						const settings = yield* load()
						yield* save({ ...settings, epicMode: mode })
					})

				const setEpicLabelFilter = (label: string | null) =>
					Effect.gen(function* () {
						const settings = yield* load()
						yield* save({ ...settings, epicLabelFilter: label?.trim() ? label.trim() : null })
					})

				const setWorkspaceRoot = (root: string | null) =>
					Effect.gen(function* () {
						const settings = yield* load()
						yield* save({ ...settings, workspaceRoot: root?.trim() ? root.trim() : null })
					})

				const setSystemThemeAutoReload = (enabled: boolean) =>
					Effect.gen(function* () {
						const settings = yield* load()
						yield* save({ ...settings, systemThemeAutoReload: enabled })
					})

				return SettingsService.of({ load, save, getPrimaryBranch, setPrimaryBranch, setEpicMode, setEpicLabelFilter, setWorkspaceRoot, setSystemThemeAutoReload })
			}),
		)
}
