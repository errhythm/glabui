import { describe, expect, test } from "bun:test"
import type { PullRequestMergeAction, PullRequestMergeInfo } from "../src/domain.js"
import { availableMergeKinds, mergeActionCliArgs, mergeKinds, visibleMergeKinds } from "../src/mergeActions.js"

const cleanInfo: PullRequestMergeInfo = {
	repository: "owner/repo",
	number: 1,
	title: "Test MR",
	state: "open",
	isDraft: false,
	mergeable: "mergeable",
	reviewStatus: "approved",
	checkStatus: "passing",
	checkSummary: "checks 5/5",
	autoMergeEnabled: false,
	viewerCanMergeAsAdmin: false,
}

describe("mergeKinds ordering", () => {
	test("source-of-truth order is now, when_pipeline_succeeds, disable-auto, admin", () => {
		expect(mergeKinds.map((kind) => kind.kind)).toEqual(["now", "when_pipeline_succeeds", "disable-auto", "admin"])
	})

	test("source-of-truth optimistic UI effects match kind behavior", () => {
		expect(Object.fromEntries(mergeKinds.map((kind) => [kind.kind, kind.optimisticState ?? kind.optimisticAutoMergeEnabled ?? null]))).toEqual({
			now: "merged",
			when_pipeline_succeeds: true,
			"disable-auto": false,
			admin: "merged",
		})
	})
})

describe("availableMergeKinds", () => {
	test("returns empty when info is null", () => {
		expect(availableMergeKinds(null)).toEqual([])
	})

	test("clean MR offers now and when_pipeline_succeeds, not admin or disable-auto", () => {
		expect(availableMergeKinds(cleanInfo).map((k) => k.kind)).toEqual(["now", "when_pipeline_succeeds"])
	})

	test("clean MR offers admin only when viewer can merge as admin", () => {
		expect(availableMergeKinds({ ...cleanInfo, viewerCanMergeAsAdmin: true }).map((k) => k.kind)).toEqual(["now", "when_pipeline_succeeds", "admin"])
	})

	test("auto-merge enabled offers now and disable-auto, not when_pipeline_succeeds", () => {
		expect(availableMergeKinds({ ...cleanInfo, autoMergeEnabled: true }).map((k) => k.kind)).toEqual(["now", "disable-auto"])
	})

	test("conflicting branch offers nothing", () => {
		expect(availableMergeKinds({ ...cleanInfo, mergeable: "conflicting" }).map((k) => k.kind)).toEqual([])
	})

	test("draft offers nothing", () => {
		expect(availableMergeKinds({ ...cleanInfo, isDraft: true }).map((k) => k.kind)).toEqual([])
	})

	test("changes-requested hides now but when_pipeline_succeeds still works", () => {
		expect(availableMergeKinds({ ...cleanInfo, reviewStatus: "changes" }).map((k) => k.kind)).toEqual(["when_pipeline_succeeds"])
	})

	test("pending checks hide now but when_pipeline_succeeds still works", () => {
		expect(availableMergeKinds({ ...cleanInfo, checkStatus: "pending" }).map((k) => k.kind)).toEqual(["when_pipeline_succeeds"])
	})

	test("failing checks hide now but when_pipeline_succeeds still works", () => {
		expect(availableMergeKinds({ ...cleanInfo, checkStatus: "failing" }).map((k) => k.kind)).toEqual(["when_pipeline_succeeds"])
	})

	test("admin can bypass changes and checks", () => {
		expect(availableMergeKinds({ ...cleanInfo, viewerCanMergeAsAdmin: true, reviewStatus: "changes" }).map((k) => k.kind)).toEqual(["when_pipeline_succeeds", "admin"])
		expect(availableMergeKinds({ ...cleanInfo, viewerCanMergeAsAdmin: true, checkStatus: "pending" }).map((k) => k.kind)).toEqual(["when_pipeline_succeeds", "admin"])
	})

	test("closed MR offers nothing", () => {
		expect(availableMergeKinds({ ...cleanInfo, state: "closed" }).map((k) => k.kind)).toEqual([])
	})
})

describe("visibleMergeKinds", () => {
	const allMethods = { squash: true, merge: true, rebase: true }

	test("returns no actions until repository merge methods load", () => {
		expect(visibleMergeKinds(cleanInfo, null, "squash")).toEqual([])
	})

	test("returns no actions when info is null", () => {
		expect(visibleMergeKinds(null, allMethods, "squash")).toEqual([])
	})

	test("hides method-specific actions when the selected method is not allowed", () => {
		expect(visibleMergeKinds({ ...cleanInfo, autoMergeEnabled: true }, { squash: false, merge: true, rebase: false }, "squash").map((kind) => kind.kind)).toEqual(["disable-auto"])
	})

	test("draft PR offers the same kinds as a ready PR (mark-ready handled at action time)", () => {
		expect(visibleMergeKinds({ ...cleanInfo, isDraft: true }, allMethods, "squash").map((kind) => kind.kind)).toEqual(["now", "when_pipeline_succeeds"])
	})

	test("draft PR with auto-merge already on still shows disable-auto and now", () => {
		expect(visibleMergeKinds({ ...cleanInfo, isDraft: true, autoMergeEnabled: true }, allMethods, "squash").map((kind) => kind.kind)).toEqual(["now", "disable-auto"])
	})
})

describe("mergeActionCliArgs", () => {
	const action = (a: PullRequestMergeAction) => mergeActionCliArgs(a)

	test("squash + now uses --squash", () => {
		expect(action({ kind: "now", method: "squash" })).toEqual(["--squash"])
	})

	test("merge + now uses --merge", () => {
		expect(action({ kind: "now", method: "merge" })).toEqual([])
	})

	test("rebase + now uses --rebase", () => {
		expect(action({ kind: "now", method: "rebase" })).toEqual(["--rebase"])
	})

	test("when_pipeline_succeeds + rebase uses --rebase --when-pipeline-succeeds", () => {
		expect(action({ kind: "when_pipeline_succeeds", method: "rebase" })).toEqual(["--when-pipeline-succeeds"])
	})

	test("admin + merge uses --force", () => {
		expect(action({ kind: "admin", method: "merge" })).toEqual(["--force"])
	})

	test("disable-auto ignores method and uses --disable-auto", () => {
		expect(action({ kind: "disable-auto" })).toEqual(["--disable-auto"])
	})
})
