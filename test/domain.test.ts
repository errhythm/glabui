import { describe, expect, test } from "bun:test"
import { pullRequestQueueSearchQualifier } from "../src/domain.js"
import { viewCacheKey } from "../src/pullRequestViews.js"

describe("pullRequestQueueSearchQualifier", () => {
	test("repository mode → 'repository'", () => {
		expect(pullRequestQueueSearchQualifier("repository", "owner/name")).toBe("repository")
	})

	test("authored mode → 'authored'", () => {
		expect(pullRequestQueueSearchQualifier("authored", null)).toBe("authored")
	})

	test("review mode → 'review'", () => {
		expect(pullRequestQueueSearchQualifier("review", "owner/name")).toBe("review")
	})

	test("assigned mode → 'assigned'", () => {
		expect(pullRequestQueueSearchQualifier("assigned", null)).toBe("assigned")
	})

	test("mentioned mode → 'mentioned'", () => {
		expect(pullRequestQueueSearchQualifier("mentioned", null)).toBe("mentioned")
	})
})

describe("viewCacheKey", () => {
	test("repository view key includes repo path", () => {
		expect(viewCacheKey({ _tag: "Repository", repository: "owner/name" })).toBe("repository:owner/name")
	})

	test("queue view key is the mode literal", () => {
		expect(viewCacheKey({ _tag: "Queue", mode: "authored", repository: null })).toBe("authored")
		expect(viewCacheKey({ _tag: "Queue", mode: "review", repository: "owner/name" })).toBe("review")
	})
})
