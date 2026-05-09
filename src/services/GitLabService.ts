import { Context, Effect, Layer, Schema } from "effect"
import {
	type CheckRollupStatus,
	type CreateMergeRequestCommentInput,
	type ListMergeRequestPageInput,
	type Mergeable,
	type MergeRequestComment,
	type MergeRequestItem,
	type MergeRequestMergeAction,
	type MergeRequestMergeInfo,
	type MergeRequestPage,
	type MergeRequestState,
	type PipelineJob,
	type PipelineStatus,
	type RepositoryMergeMethods,
	type ReviewStatus,
	type SubmitMergeRequestReviewInput,
} from "../domain.js"
import { CommandError, CommandRunner, type JsonParseError } from "./CommandRunner.js"

const NullableString = Schema.NullOr(Schema.String)
const OptionalNullableString = Schema.optionalKey(NullableString)
const OptionalNullableNumber = Schema.optionalKey(Schema.NullOr(Schema.Number))

// ── Raw GitLab API schemas ──────────────────────────────────────────────────

const RawUserSchema = Schema.Struct({
	id: Schema.Number,
	username: Schema.String,
	name: Schema.optionalKey(Schema.String),
})

const RawLabelSchema = Schema.String

const RawPipelineSchema = Schema.Struct({
	id: Schema.optionalKey(Schema.NullOr(Schema.Number)),
	status: OptionalNullableString,
	sha: OptionalNullableString,
	ref: OptionalNullableString,
	web_url: OptionalNullableString,
})

const RawMergeRequestSchema = Schema.Struct({
	id: Schema.Number,
	iid: Schema.Number,
	project_id: Schema.Number,
	title: Schema.String,
	description: OptionalNullableString,
	state: Schema.String,
	created_at: Schema.String,
	updated_at: OptionalNullableString,
	merged_at: OptionalNullableString,
	closed_at: OptionalNullableString,
	target_branch: Schema.String,
	source_branch: Schema.String,
	author: RawUserSchema,
	assignees: Schema.optionalKey(Schema.Array(RawUserSchema)),
	reviewers: Schema.optionalKey(Schema.Array(RawUserSchema)),
	labels: Schema.Array(RawLabelSchema),
	draft: Schema.Boolean,
	work_in_progress: Schema.optionalKey(Schema.Boolean),
	merge_status: OptionalNullableString,
	detailed_merge_status: OptionalNullableString,
	merge_when_pipeline_succeeds: Schema.Boolean,
	sha: OptionalNullableString,
	web_url: Schema.String,
	squash: Schema.Boolean,
	has_conflicts: Schema.optionalKey(Schema.Boolean),
	blocking_discussions_resolved: Schema.optionalKey(Schema.Boolean),
	references: Schema.optionalKey(
		Schema.Struct({
			full: Schema.String,
		}),
	),
	head_pipeline: Schema.optionalKey(Schema.NullOr(RawPipelineSchema)),
	pipeline: Schema.optionalKey(Schema.NullOr(RawPipelineSchema)),
})

type RawMergeRequest = Schema.Schema.Type<typeof RawMergeRequestSchema>

const RawMergeRequestListSchema = Schema.Array(RawMergeRequestSchema)

const RawMergeRequestDetailSchema = Schema.Struct({
	id: Schema.Number,
	iid: Schema.Number,
	project_id: Schema.Number,
	title: Schema.String,
	description: OptionalNullableString,
	state: Schema.String,
	created_at: Schema.String,
	merged_at: OptionalNullableString,
	closed_at: OptionalNullableString,
	target_branch: Schema.String,
	source_branch: Schema.String,
	author: RawUserSchema,
	labels: Schema.Array(RawLabelSchema),
	draft: Schema.Boolean,
	merge_status: OptionalNullableString,
	detailed_merge_status: OptionalNullableString,
	merge_when_pipeline_succeeds: Schema.Boolean,
	sha: OptionalNullableString,
	web_url: Schema.String,
	squash: Schema.Boolean,
	has_conflicts: Schema.optionalKey(Schema.Boolean),
	blocking_discussions_resolved: Schema.optionalKey(Schema.Boolean),
	changes_count: OptionalNullableString,
	additions: Schema.optionalKey(Schema.Number),
	deletions: Schema.optionalKey(Schema.Number),
	head_pipeline: Schema.optionalKey(Schema.NullOr(RawPipelineSchema)),
	approvals_before_merge: OptionalNullableNumber,
	user: Schema.optionalKey(
		Schema.Struct({
			can_merge: Schema.optionalKey(Schema.Boolean),
		}),
	),
})

type RawMergeRequestDetail = Schema.Schema.Type<typeof RawMergeRequestDetailSchema>

const RawPipelineJobSchema = Schema.Struct({
	id: Schema.Number,
	name: Schema.String,
	status: Schema.String,
	stage: Schema.String,
	web_url: OptionalNullableString,
})

const RawPipelineJobsSchema = Schema.Array(RawPipelineJobSchema)

const RawDiscussionNoteSchema = Schema.Struct({
	id: Schema.Number,
	type: OptionalNullableString,
	body: OptionalNullableString,
	author: RawUserSchema,
	created_at: OptionalNullableString,
	updated_at: OptionalNullableString,
	system: Schema.optionalKey(Schema.Boolean),
	position: Schema.optionalKey(
		Schema.NullOr(
			Schema.Struct({
				base_sha: OptionalNullableString,
				start_sha: OptionalNullableString,
				head_sha: OptionalNullableString,
				old_path: OptionalNullableString,
				new_path: OptionalNullableString,
				position_type: OptionalNullableString,
				old_line: OptionalNullableNumber,
				new_line: OptionalNullableNumber,
				line_range: Schema.optionalKey(Schema.Unknown),
			}),
		),
	),
	resolved: Schema.optionalKey(Schema.Boolean),
	resolvable: Schema.optionalKey(Schema.Boolean),
	noteable_type: OptionalNullableString,
})

const RawDiscussionSchema = Schema.Struct({
	id: Schema.String,
	individual_note: Schema.Boolean,
	notes: Schema.Array(RawDiscussionNoteSchema),
})

// Schema for the created note response
const RawCreatedNoteSchema = Schema.Struct({
	id: Schema.Number,
	body: Schema.optionalKey(Schema.NullOr(Schema.String)),
	author: Schema.Struct({ username: Schema.String }),
	created_at: Schema.optionalKey(Schema.NullOr(Schema.String)),
	position: Schema.optionalKey(
		Schema.NullOr(
			Schema.Struct({
				new_path: Schema.optionalKey(Schema.NullOr(Schema.String)),
				old_path: Schema.optionalKey(Schema.NullOr(Schema.String)),
				new_line: Schema.optionalKey(Schema.NullOr(Schema.Number)),
				old_line: Schema.optionalKey(Schema.NullOr(Schema.Number)),
			}),
		),
	),
})

const RawDiscussionsSchema = Schema.Array(RawDiscussionSchema)

const RawMRDiffSchema = Schema.Struct({
	diff: Schema.String,
	new_path: Schema.String,
	old_path: Schema.String,
	new_file: Schema.Boolean,
	renamed_file: Schema.Boolean,
	deleted_file: Schema.Boolean,
	too_large: Schema.optionalKey(Schema.Boolean),
	collapsed: Schema.optionalKey(Schema.Boolean),
})

const RawMRDiffsSchema = Schema.Array(RawMRDiffSchema)

const RawLabelItemSchema = Schema.Struct({
	id: Schema.Number,
	name: Schema.String,
	color: Schema.String,
	description: OptionalNullableString,
})

const RawLabelsSchema = Schema.Array(RawLabelItemSchema)

const RawProjectSchema = Schema.Struct({
	id: Schema.Number,
	name: Schema.String,
	path_with_namespace: Schema.String,
	squash_option: OptionalNullableString,
	merge_method: OptionalNullableString,
	web_url: OptionalNullableString,
})

const RawApprovalStateSchema = Schema.Struct({
	rules: Schema.optionalKey(
		Schema.Array(
			Schema.Struct({
				name: Schema.String,
				approvals_required: Schema.Number,
				approved: Schema.optionalKey(Schema.Boolean),
				approved_by: Schema.optionalKey(
					Schema.Array(
						Schema.Struct({
							username: Schema.String,
						}),
					),
				),
			}),
		),
	),
})

// ── Conversion helpers ──────────────────────────────────────────────────────

const parsePipelineStatus = (status: string | null | undefined): PipelineStatus => {
	const valid = ["success", "failed", "canceled", "skipped", "running", "pending", "created", "manual", "scheduled", "preparing", "waiting_for_resource"] as const
	if (status && (valid as readonly string[]).includes(status)) return status as PipelineStatus
	return "created"
}

const pipelineToCheckRollup = (pipeline: { status?: string | null | undefined } | null | undefined): CheckRollupStatus => {
	if (!pipeline) return "none"
	const s = pipeline.status ?? ""
	if (s === "success") return "passing"
	if (s === "failed" || s === "canceled") return "failing"
	if (s === "running" || s === "pending" || s === "created" || s === "preparing" || s === "waiting_for_resource") return "pending"
	if (s === "skipped" || s === "manual") return "none"
	return "none"
}

const mrStateToLocal = (state: string, merged: boolean): MergeRequestState => {
	if (merged || state === "merged") return "merged"
	if (state === "closed") return "closed"
	return "open"
}

const detailedMergeStatusToMergeable = (status: string | null | undefined, hasConflicts: boolean | undefined): Mergeable => {
	if (hasConflicts) return "conflicting"
	if (!status) return "unknown"
	if (status === "mergeable" || status === "ci_still_running" || status === "not_approved") return "mergeable"
	if (status === "merge_conflict" || status === "conflict") return "conflicting"
	return "unknown"
}

const approvalStatusToReviewStatus = (mr: Pick<RawMergeRequest | RawMergeRequestDetail, "draft" | "state">, approvedByMe: boolean, needsApproval: boolean): ReviewStatus => {
	if (mr.draft) return "draft"
	if (approvedByMe) return "approved"
	if (needsApproval) return "review"
	return "none"
}

const toMergeRequestItem = (raw: RawMergeRequest, repository: string, approvedByMe: boolean, needsApproval: boolean): MergeRequestItem => {
	const pipeline = raw.head_pipeline ?? raw.pipeline
	const checkStatus = pipelineToCheckRollup(pipeline)
	const checkSummary = pipeline?.status ?? null

	return {
		repository,
		author: raw.author.username,
		headRefOid: raw.sha ?? "",
		headRefName: raw.source_branch,
		number: raw.iid,
		title: raw.title,
		body: raw.description ?? "",
		labels: raw.labels.map((name) => ({ name, color: null })),
		additions: 0,
		deletions: 0,
		changedFiles: 0,
		state: mrStateToLocal(raw.state, raw.state === "merged"),
		isDraft: raw.draft,
		reviewStatus: approvalStatusToReviewStatus(raw, approvedByMe, needsApproval),
		checkStatus,
		checkSummary,
		checks: [],
		autoMergeEnabled: raw.merge_when_pipeline_succeeds,
		detailLoaded: false,
		createdAt: new Date(raw.created_at),
		closedAt: raw.merged_at ? new Date(raw.merged_at) : raw.closed_at ? new Date(raw.closed_at) : null,
		url: raw.web_url,
	}
}

const encodeProjectPath = (repository: string) => encodeURIComponent(repository)

// ── Service interface ───────────────────────────────────────────────────────

export interface GitLabDiff {
	readonly filename: string
	readonly previousFilename: string | null
	readonly status: "added" | "modified" | "deleted" | "renamed"
	readonly patch: string
}

export class GitLabService extends Context.Service<
	GitLabService,
	{
		readonly getViewer: () => Effect.Effect<string, CommandError | JsonParseError | Schema.SchemaError>
		readonly listMergeRequests: (input: ListMergeRequestPageInput) => Effect.Effect<MergeRequestPage, CommandError | JsonParseError | Schema.SchemaError>
		readonly getMergeRequestDetail: (repository: string, number: number) => Effect.Effect<MergeRequestItem, CommandError | JsonParseError | Schema.SchemaError>
		readonly getMergeRequestMergeInfo: (input: { repository: string; number: number }) => Effect.Effect<MergeRequestMergeInfo, CommandError | JsonParseError | Schema.SchemaError>
		readonly getMergeRequestDiff: (repository: string, number: number, commitId: string) => Effect.Effect<readonly GitLabDiff[], CommandError | JsonParseError | Schema.SchemaError>
		readonly getMergeRequestComments: (repository: string, number: number) => Effect.Effect<readonly MergeRequestComment[], CommandError | JsonParseError | Schema.SchemaError>
		readonly createMergeRequestComment: (input: CreateMergeRequestCommentInput) => Effect.Effect<MergeRequestComment, CommandError | JsonParseError | Schema.SchemaError>
		readonly replyToDiscussion: (
			repository: string,
			number: number,
			discussionId: string,
			body: string,
		) => Effect.Effect<MergeRequestComment, CommandError | JsonParseError | Schema.SchemaError>
		readonly editMergeRequestComment: (
			repository: string,
			number: number,
			noteId: string,
			body: string,
		) => Effect.Effect<MergeRequestComment, CommandError | JsonParseError | Schema.SchemaError>
		readonly deleteMergeRequestComment: (repository: string, number: number, noteId: string) => Effect.Effect<void, CommandError | JsonParseError | Schema.SchemaError>
		readonly submitMergeRequestReview: (input: SubmitMergeRequestReviewInput) => Effect.Effect<void, CommandError | JsonParseError | Schema.SchemaError>
		readonly mergeMergeRequest: (input: {
			repository: string
			number: number
			action: MergeRequestMergeAction
		}) => Effect.Effect<void, CommandError | JsonParseError | Schema.SchemaError>
		readonly closeMergeRequest: (input: { repository: string; number: number }) => Effect.Effect<void, CommandError | JsonParseError | Schema.SchemaError>
		readonly toggleDraftStatus: (input: { repository: string; number: number; isDraft: boolean }) => Effect.Effect<void, CommandError | JsonParseError | Schema.SchemaError>
		readonly addLabel: (input: { repository: string; number: number; label: string }) => Effect.Effect<void, CommandError | JsonParseError | Schema.SchemaError>
		readonly removeLabel: (input: { repository: string; number: number; label: string }) => Effect.Effect<void, CommandError | JsonParseError | Schema.SchemaError>
		readonly getRepositoryLabels: (repository: string) => Effect.Effect<readonly { name: string; color: string }[], CommandError | JsonParseError | Schema.SchemaError>
		readonly getRepositoryMergeMethods: (repository: string) => Effect.Effect<RepositoryMergeMethods, CommandError | JsonParseError | Schema.SchemaError>
		readonly openInBrowser: (url: string) => Effect.Effect<void, CommandError>
		readonly getPipelineJobs: (repository: string, pipelineId: number) => Effect.Effect<readonly PipelineJob[], CommandError | JsonParseError | Schema.SchemaError>
	}
>()("glabui/GitLabService") {
	static readonly layer = Layer.effect(
		GitLabService,
		Effect.gen(function* () {
			const runner = yield* CommandRunner

			const getViewer = () =>
				Effect.gen(function* () {
					const result = yield* runner.runSchema(Schema.Struct({ username: Schema.String }), "glab", ["api", "user"])
					return result.username
				})

			const getCurrentUsername = () =>
				Effect.gen(function* () {
					const result = yield* runner.runSchema(Schema.Struct({ username: Schema.String }), "glab", ["api", "user"])
					return result.username
				})

			const listMergeRequests = (input: ListMergeRequestPageInput) =>
				Effect.gen(function* () {
					const { mode, repository, cursor, pageSize } = input
					const page = cursor ? Number.parseInt(cursor, 10) : 1
					const safePageSize = Math.min(pageSize, 100)

					let endpoint: string
					let items: MergeRequestItem[]

					const username = yield* getCurrentUsername()

					if (repository) {
						const scopeParam = (() => {
							switch (mode) {
								case "authored":
									return `author_username=${username}`
								case "review":
									return `reviewer_username=${username}`
								case "assigned":
									return `assignee_username=${username}`
								default:
									return ""
							}
						})()
						const scopePart = scopeParam ? `&${scopeParam}` : ""
						endpoint = `projects/${encodeProjectPath(repository)}/merge_requests?state=opened&per_page=${safePageSize}&page=${page}${scopePart}`
					} else {
						const scope = (() => {
							switch (mode) {
								case "authored":
									return "created_by_me"
								case "review":
									return "all"
								case "assigned":
									return "assigned_to_me"
								default:
									return "created_by_me"
							}
						})()
						const reviewerParam = mode === "review" ? `&reviewer_username=${username}` : ""
						endpoint = `merge_requests?scope=${scope}&state=opened&per_page=${safePageSize}&page=${page}${reviewerParam}`
					}

					const rawList = yield* runner.runSchema(RawMergeRequestListSchema, "glab", ["api", endpoint])

					items = rawList.map((raw) => {
						const repo = repository ?? raw.references?.full?.split("!")?.shift()?.trim() ?? raw.web_url.replace(/https?:\/\/[^/]+\//, "").replace(/\/-\/merge_requests\/.*$/, "")
						return toMergeRequestItem(raw, repo, false, false)
					})

					const hasNextPage = rawList.length === safePageSize
					const nextPage = hasNextPage ? String(page + 1) : null

					return {
						items,
						endCursor: nextPage,
						hasNextPage,
					} satisfies MergeRequestPage
				})

			const getMergeRequestDetail = (repository: string, number: number) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}`
					const raw = yield* runner.runSchema(RawMergeRequestDetailSchema, "glab", ["api", endpoint])

					const changedFiles = raw.changes_count ? Number.parseInt(raw.changes_count, 10) : 0

					return {
						repository,
						author: raw.author.username,
						headRefOid: raw.sha ?? "",
						headRefName: raw.source_branch,
						number: raw.iid,
						title: raw.title,
						body: raw.description ?? "",
						labels: raw.labels.map((name) => ({ name, color: null })),
						additions: raw.additions ?? 0,
						deletions: raw.deletions ?? 0,
						changedFiles,
						state: mrStateToLocal(raw.state, raw.state === "merged"),
						isDraft: raw.draft,
						reviewStatus: (raw.draft ? "draft" : "none") as ReviewStatus,
						checkStatus: pipelineToCheckRollup(raw.head_pipeline ?? null),
						checkSummary: raw.head_pipeline?.status ?? null,
						checks: [],
						autoMergeEnabled: raw.merge_when_pipeline_succeeds,
						detailLoaded: true,
						createdAt: new Date(raw.created_at),
						closedAt: raw.merged_at ? new Date(raw.merged_at) : raw.closed_at ? new Date(raw.closed_at) : null,
						url: raw.web_url,
					} satisfies MergeRequestItem
				})

			const getMergeRequestMergeInfo = (input: { repository: string; number: number }) =>
				Effect.gen(function* () {
					const { repository, number } = input
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}`
					const raw = yield* runner.runSchema(RawMergeRequestDetailSchema, "glab", ["api", endpoint])

					const canMerge = raw.user?.can_merge ?? false
					const mergeable = detailedMergeStatusToMergeable(raw.detailed_merge_status, raw.has_conflicts)
					const checkStatus = pipelineToCheckRollup(raw.head_pipeline ?? null)

					// Check approval state
					const approvalEndpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/approval_state`
					const approvalState = yield* runner.runSchema(RawApprovalStateSchema, "glab", ["api", approvalEndpoint]).pipe(Effect.catch(() => Effect.succeed({ rules: [] })))
					const allApproved = (approvalState.rules ?? []).every((r) => r.approved !== false)
					const reviewStatus: ReviewStatus = raw.draft ? "draft" : allApproved ? "approved" : "review"

					return {
						repository,
						number,
						title: raw.title,
						state: mrStateToLocal(raw.state, raw.state === "merged"),
						isDraft: raw.draft,
						mergeable,
						reviewStatus,
						checkStatus,
						checkSummary: raw.head_pipeline?.status ?? null,
						autoMergeEnabled: raw.merge_when_pipeline_succeeds,
						viewerCanMergeAsAdmin: canMerge,
					} satisfies MergeRequestMergeInfo
				})

			const getMergeRequestDiff = (repository: string, number: number, _commitId: string) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/diffs?per_page=100`
					const rawDiffs = yield* runner.runSchema(RawMRDiffsSchema, "glab", ["api", endpoint])

					return rawDiffs.map((d) => ({
						filename: d.new_path,
						previousFilename: d.renamed_file ? d.old_path : null,
						status: d.new_file ? ("added" as const) : d.deleted_file ? ("deleted" as const) : d.renamed_file ? ("renamed" as const) : ("modified" as const),
						patch: d.diff,
					})) satisfies GitLabDiff[]
				})

			const getMergeRequestComments = (repository: string, number: number) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/discussions?per_page=100`
					const discussions = yield* runner.runSchema(RawDiscussionsSchema, "glab", ["api", endpoint])

					const comments: MergeRequestComment[] = []

					for (const discussion of discussions) {
						for (const note of discussion.notes) {
							if (note.system) continue
							if (note.position) {
								// inline diff comment
								const pos = note.position
								const line = pos?.new_line ?? pos?.old_line ?? 0
								const side: import("../domain.js").DiffCommentSide = pos?.old_line && !pos?.new_line ? "LEFT" : "RIGHT"
								const comment: MergeRequestComment = {
									_tag: "review-comment",
									id: `${note.id}`,
									path: pos?.new_path ?? pos?.old_path ?? "",
									line: line ?? 0,
									side,
									author: note.author.username,
									body: note.body ?? "",
									createdAt: note.created_at ? new Date(note.created_at) : null,
									url: null,
									inReplyTo: null,
								}
								comments.push(comment)
							} else {
								const comment: MergeRequestComment = {
									_tag: "comment",
									id: `${note.id}`,
									author: note.author.username,
									body: note.body ?? "",
									createdAt: note.created_at ? new Date(note.created_at) : null,
									url: null,
								}
								comments.push(comment)
							}
						}
					}

					return comments
				})

			const createMergeRequestComment = (input: CreateMergeRequestCommentInput) =>
				Effect.gen(function* () {
					const { repository, number, path, line, side, startLine, body } = input

					// If no position info, post a general MR note
					if (!path || line === undefined || !side) {
						const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/notes`
						const raw = yield* runner.runSchema(RawCreatedNoteSchema, "glab", ["api", endpoint, "-X", "POST", "-f", `body=${body}`])
						const result: MergeRequestComment = {
							_tag: "comment",
							id: `${raw.id}`,
							author: raw.author.username,
							body: raw.body ?? body,
							createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
							url: null,
						}
						return result
					}

					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/discussions`

					// Get MR diff refs for position
					const mrEndpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}`
					const mr = yield* runner.runSchema(
						Schema.Struct({ diff_refs: Schema.NullOr(Schema.Struct({ base_sha: Schema.String, start_sha: Schema.String, head_sha: Schema.String })) }),
						"glab",
						["api", mrEndpoint],
					)

					if (mr.diff_refs) {
						const args = [
							"api",
							endpoint,
							"-X",
							"POST",
							"-f",
							`body=${body}`,
							"-f",
							`position[position_type]=text`,
							"-f",
							`position[base_sha]=${mr.diff_refs.base_sha}`,
							"-f",
							`position[start_sha]=${mr.diff_refs.start_sha}`,
							"-f",
							`position[head_sha]=${mr.diff_refs.head_sha}`,
							"-f",
							`position[new_path]=${path}`,
							"-f",
							`position[old_path]=${path}`,
						]

						if (side === "LEFT") {
							args.push("-f", `position[old_line]=${line}`)
						} else {
							args.push("-f", `position[new_line]=${line}`)
						}

						if (startLine !== undefined) {
							if (side === "LEFT") {
								args.push("-f", `position[line_range][start][line_code]=${path}_${startLine}_${startLine}`)
								args.push("-f", `position[line_range][start][type]=old`)
								args.push("-f", `position[line_range][end][line_code]=${path}_${line}_${line}`)
								args.push("-f", `position[line_range][end][type]=old`)
							} else {
								args.push("-f", `position[line_range][start][line_code]=${path}_${startLine}_${startLine}`)
								args.push("-f", `position[line_range][start][type]=new`)
								args.push("-f", `position[line_range][end][line_code]=${path}_${line}_${line}`)
								args.push("-f", `position[line_range][end][type]=new`)
							}
						}

						// Discussion create returns { id, notes: [...] }
						const rawDisc = yield* runner.runSchema(Schema.Struct({ notes: Schema.Array(RawCreatedNoteSchema) }), "glab", args)
						const firstNote = rawDisc.notes[0]
						const result: MergeRequestComment = {
							_tag: "review-comment",
							id: firstNote ? `${firstNote.id}` : `local:${Date.now()}`,
							path,
							line,
							side,
							author: firstNote?.author.username ?? "you",
							body: firstNote?.body ?? body,
							createdAt: firstNote?.created_at ? new Date(firstNote.created_at) : new Date(),
							url: null,
							inReplyTo: null,
						}
						return result
					} else {
						// fallback to general note
						const notesEndpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/notes`
						const raw = yield* runner.runSchema(RawCreatedNoteSchema, "glab", ["api", notesEndpoint, "-X", "POST", "-f", `body=${body}`])
						const result: MergeRequestComment = {
							_tag: "review-comment",
							id: `${raw.id}`,
							path,
							line,
							side,
							author: raw.author.username,
							body: raw.body ?? body,
							createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
							url: null,
							inReplyTo: null,
						}
						return result
					}
				})

			const replyToDiscussion = (repository: string, number: number, discussionId: string, body: string) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/discussions/${discussionId}/notes`
					const raw = yield* runner.runSchema(RawCreatedNoteSchema, "glab", ["api", endpoint, "-X", "POST", "-f", `body=${body}`])
					const result: MergeRequestComment = {
						_tag: "comment",
						id: `${raw.id}`,
						author: raw.author.username,
						body: raw.body ?? body,
						createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
						url: null,
					}
					return result
				})

			const editMergeRequestComment = (repository: string, number: number, noteId: string, body: string) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/notes/${noteId}`
					const raw = yield* runner.runSchema(RawCreatedNoteSchema, "glab", ["api", endpoint, "-X", "PUT", "-f", `body=${body}`])
					const pos = raw.position
					const result: MergeRequestComment = pos
						? {
								_tag: "review-comment",
								id: `${raw.id}`,
								path: pos.new_path ?? pos.old_path ?? "",
								line: pos.new_line ?? pos.old_line ?? 0,
								side: (pos.old_line && !pos.new_line ? "LEFT" : "RIGHT") as import("../domain.js").DiffCommentSide,
								author: raw.author.username,
								body: raw.body ?? body,
								createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
								url: null,
								inReplyTo: null,
							}
						: {
								_tag: "comment",
								id: `${raw.id}`,
								author: raw.author.username,
								body: raw.body ?? body,
								createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
								url: null,
							}
					return result
				})

			const deleteMergeRequestComment = (repository: string, number: number, noteId: string) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/notes/${noteId}`
					yield* runner.run("glab", ["api", endpoint, "-X", "DELETE"])
				})

			const submitMergeRequestReview = (input: SubmitMergeRequestReviewInput) =>
				Effect.gen(function* () {
					const { repository, number, event, body } = input
					if (event === "APPROVE") {
						const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/approve`
						yield* runner.run("glab", ["api", endpoint, "-X", "POST"])
					} else if (event === "REQUEST_CHANGES") {
						// GitLab doesn't have request-changes directly; add a note
						const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/notes`
						if (body) {
							yield* runner.run("glab", ["api", endpoint, "-X", "POST", "-f", `body=${body}`])
						}
					} else {
						// COMMENT
						if (body) {
							const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/notes`
							yield* runner.run("glab", ["api", endpoint, "-X", "POST", "-f", `body=${body}`])
						}
					}
				})

			const mergeMergeRequest = (input: { repository: string; number: number; action: MergeRequestMergeAction }) =>
				Effect.gen(function* () {
					const { repository, number, action } = input
					if (action.kind === "disable-auto") {
						const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/cancel_merge_when_pipeline_succeeds`
						yield* runner.run("glab", ["api", endpoint, "-X", "POST"])
						return
					}
					if (action.kind === "when_pipeline_succeeds") {
						const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/merge`
						yield* runner.run("glab", ["api", endpoint, "-X", "PUT", "-f", "merge_when_pipeline_succeeds=true"])
						return
					}
					// now or admin
					const squash = action.method === "squash"
					const rebase = action.method === "rebase"
					if (rebase) {
						const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/rebase`
						yield* runner.run("glab", ["api", endpoint, "-X", "PUT"])
					} else {
						const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}/merge`
						yield* runner.run("glab", ["api", endpoint, "-X", "PUT", `-f`, `squash=${squash}`])
					}
				})

			const closeMergeRequest = (input: { repository: string; number: number }) =>
				Effect.gen(function* () {
					const { repository, number } = input
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}`
					yield* runner.run("glab", ["api", endpoint, "-X", "PUT", "-f", "state_event=close"])
				})

			const toggleDraftStatus = (input: { repository: string; number: number; isDraft: boolean }) =>
				Effect.gen(function* () {
					const { repository, number, isDraft } = input
					// isDraft=true means currently draft, so we're marking it ready (removing draft)
					// isDraft=false means marking it as draft
					yield* runner.run("glab", ["mr", "update", `${number}`, isDraft ? "--ready" : "--draft", "-R", repository])
				})

			const addLabel = (input: { repository: string; number: number; label: string }) =>
				Effect.gen(function* () {
					const { repository, number, label } = input
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}`
					yield* runner.run("glab", ["api", endpoint, "-X", "PUT", "-f", `add_labels=${label}`])
				})

			const removeLabel = (input: { repository: string; number: number; label: string }) =>
				Effect.gen(function* () {
					const { repository, number, label } = input
					const endpoint = `projects/${encodeProjectPath(repository)}/merge_requests/${number}`
					yield* runner.run("glab", ["api", endpoint, "-X", "PUT", "-f", `remove_labels=${label}`])
				})

			const getRepositoryLabels = (repository: string) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/labels?per_page=100`
					const labels = yield* runner.runSchema(RawLabelsSchema, "glab", ["api", endpoint])
					return labels.map((l) => ({ name: l.name, color: l.color }))
				})

			const getRepositoryMergeMethods = (repository: string) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}`
					const project = yield* runner.runSchema(RawProjectSchema, "glab", ["api", endpoint])
					const mergeMethod = project.merge_method ?? "merge"
					const squashOption = project.squash_option ?? "default_off"

					// GitLab merge_method: merge, rebase_merge, ff (fast-forward)
					const canMerge = mergeMethod === "merge" || mergeMethod === "ff"
					const canRebase = mergeMethod === "rebase_merge" || mergeMethod === "merge"
					const canSquash = squashOption !== "never"

					return {
						squash: canSquash,
						merge: canMerge,
						rebase: canRebase,
					} satisfies RepositoryMergeMethods
				})

			const openInBrowser = (url: string) =>
				Effect.gen(function* () {
					yield* runner.run("open", [url])
				})

			const getPipelineJobs = (repository: string, pipelineId: number) =>
				Effect.gen(function* () {
					const endpoint = `projects/${encodeProjectPath(repository)}/pipelines/${pipelineId}/jobs?per_page=100`
					const jobs = yield* runner.runSchema(RawPipelineJobsSchema, "glab", ["api", endpoint])
					return jobs.map((j) => ({
						name: j.name,
						status: parsePipelineStatus(j.status),
						stage: j.stage,
					})) satisfies PipelineJob[]
				})

			return GitLabService.of({
				getViewer,
				listMergeRequests,
				getMergeRequestDetail,
				getMergeRequestMergeInfo,
				getMergeRequestDiff,
				getMergeRequestComments,
				createMergeRequestComment,
				replyToDiscussion,
				editMergeRequestComment,
				deleteMergeRequestComment,
				submitMergeRequestReview,
				mergeMergeRequest,
				closeMergeRequest,
				toggleDraftStatus,
				addLabel,
				removeLabel,
				getRepositoryLabels,
				getRepositoryMergeMethods,
				openInBrowser,
				getPipelineJobs,
			})
		}),
	)
}
