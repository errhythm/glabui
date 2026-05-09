import { homedir } from "node:os"
import { join } from "node:path"
import { Config, Effect } from "effect"

const positiveIntOr = (fallback: number) => (value: number) => (Number.isFinite(value) && value > 0 ? value : fallback)

const pageSizeOr = (fallback: number) => (value: number) => Math.min(100, positiveIntOr(fallback)(value))

const defaultCachePath = () => join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "glabui", "cache.sqlite")

const resolveCachePath = () => {
	const value = process.env.GLABUI_CACHE_PATH?.trim()
	if (value === "off" || value === "0" || value === "false") return null
	return value && value.length > 0 ? value : defaultCachePath()
}

const appConfig = Config.all({
	mrFetchLimit: Config.int("GLABUI_MR_FETCH_LIMIT").pipe(Config.withDefault(200), Config.map(positiveIntOr(200))),
	mrPageSize: Config.int("GLABUI_MR_PAGE_SIZE").pipe(Config.withDefault(50), Config.map(pageSizeOr(50))),
	cachePath: Config.succeed(resolveCachePath()),
	// Optional GitLab host override (defaults to gitlab.com)
	gitlabHost: Config.string("GLABUI_GITLAB_HOST").pipe(Config.withDefault("gitlab.com")),
})

export const config = Effect.runSync(
	Effect.gen(function* () {
		return yield* appConfig
	}),
)
