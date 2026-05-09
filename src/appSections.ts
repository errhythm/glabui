import type { AppSection } from "./domain.js"

export const appSectionOrder: readonly AppSection[] = ["merge-requests", "workspace", "epics", "issues"]

export const appSectionLabel = (section: AppSection) => {
	switch (section) {
		case "merge-requests":
			return "merge requests"
		case "workspace":
			return "workspace"
		case "issues":
			return "issues"
		case "epics":
			return "epics"
	}
}

export const nextAppSection = (current: AppSection, delta: 1 | -1): AppSection => {
	const index = appSectionOrder.indexOf(current)
	if (index < 0) return appSectionOrder[0]!
	return appSectionOrder[(index + delta + appSectionOrder.length) % appSectionOrder.length]!
}
