import { z } from "zod";

export const SCHEMA_VERSION = 1;

const uuidV4 =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

function prefixedId(prefix: string) {
  return z
    .string()
    .regex(
      new RegExp(`^${prefix}_${uuidV4}$`, "i"),
      `Идентификатор должен иметь префикс ${prefix}.`,
    );
}

export const studentIdSchema = prefixedId("student");
export const projectIdSchema = prefixedId("project");
export const updateRunIdSchema = prefixedId("run");
export const updateEventIdSchema = prefixedId("update");
export const commentIdSchema = prefixedId("comment");
export const reviewStatusIdSchema = prefixedId("review_status");
export const aiReportIdSchema = prefixedId("ai_report");

export const isoUtcDateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    "Дата должна быть в формате ISO 8601 UTC.",
  );

export const projectStatusSchema = z.enum([
  "not_connected",
  "never_updated",
  "updating",
  "first_loaded",
  "no_changes",
  "has_changes",
  "update_error",
  "local_copy_missing",
  "local_copy_unavailable",
  "repository_unavailable",
]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectStatusLabels: Record<ProjectStatus, string> = {
  not_connected: "проект не подключен",
  never_updated: "проект еще не обновлялся",
  updating: "обновление выполняется",
  first_loaded: "первая загрузка требует проверки",
  no_changes: "новых изменений нет",
  has_changes: "есть новые изменения",
  update_error: "обновление завершилось ошибкой",
  local_copy_missing: "локальная копия отсутствует",
  local_copy_unavailable: "локальная копия недоступна",
  repository_unavailable: "репозиторий недоступен",
};

export const updateRunScopeSchema = z.enum(["all_projects", "single_project"]);
export type UpdateRunScope = z.infer<typeof updateRunScopeSchema>;

export const updateRunStatusSchema = z.enum([
  "running",
  "completed",
  "completed_with_errors",
  "failed",
]);
export type UpdateRunStatus = z.infer<typeof updateRunStatusSchema>;

export const updateRunSummarySchema = z.object({
  studentsTotal: z.number().int().nonnegative(),
  projectsAttempted: z.number().int().nonnegative(),
  projectsFirstLoaded: z.number().int().nonnegative(),
  projectsWithChanges: z.number().int().nonnegative(),
  newCommitsTotal: z.number().int().nonnegative(),
  projectsWithoutChanges: z.number().int().nonnegative(),
  errorsTotal: z.number().int().nonnegative(),
  studentsWithoutRepository: z.number().int().nonnegative(),
});
export type UpdateRunSummary = z.infer<typeof updateRunSummarySchema>;

export const updateRunSchema = z.object({
  id: updateRunIdSchema,
  scope: updateRunScopeSchema,
  studentId: studentIdSchema.nullable(),
  projectId: projectIdSchema.nullable(),
  status: updateRunStatusSchema,
  startedAt: isoUtcDateSchema,
  finishedAt: isoUtcDateSchema.nullable(),
  summary: updateRunSummarySchema,
  error: z.string().nullable(),
});
export type UpdateRun = z.infer<typeof updateRunSchema>;

export const updateEventStatusSchema = z.enum(["running", "completed", "failed", "interrupted"]);
export type UpdateEventStatus = z.infer<typeof updateEventStatusSchema>;

export const updateEventResultSchema = z.enum([
  "skipped_no_repository",
  "cloned",
  "updated_with_changes",
  "updated_no_changes",
  "error",
]);
export type UpdateEventResult = z.infer<typeof updateEventResultSchema>;

export const updateEventResultLabels: Record<UpdateEventResult, string> = {
  skipped_no_repository: "проект не подключен",
  cloned: "первая загрузка проекта",
  updated_with_changes: "найдены новые изменения",
  updated_no_changes: "новых изменений нет",
  error: "обновление завершилось ошибкой",
};

export const updateEventSchema = z.object({
  id: updateEventIdSchema,
  runId: updateRunIdSchema,
  studentId: studentIdSchema,
  projectId: projectIdSchema,
  status: updateEventStatusSchema,
  startedAt: isoUtcDateSchema,
  finishedAt: isoUtcDateSchema.nullable(),
  occurredAt: isoUtcDateSchema.nullable(),
  repositoryUrlSnapshot: z.string().nullable(),
  projectLocalPathSnapshot: z.string().nullable(),
  branch: z.literal("main"),
  previousCommit: z.string().nullable(),
  newCommit: z.string().nullable(),
  newCommitsCount: z.number().int().nonnegative().nullable(),
  hasNewChanges: z.boolean(),
  result: updateEventResultSchema.nullable(),
  error: z.string().nullable(),
  analysisBoundaryRecordedAt: isoUtcDateSchema.nullable(),
  createdAt: isoUtcDateSchema,
  updatedAt: isoUtcDateSchema,
});
export type UpdateEvent = z.infer<typeof updateEventSchema>;

export const reviewStatusValueSchema = z.enum([
  "not_reviewed",
  "in_review",
  "reviewed",
  "needs_work",
  "needs_recheck",
  "skipped",
]);
export type ReviewStatusValue = z.infer<typeof reviewStatusValueSchema>;

export const reviewStatusLabels: Record<ReviewStatusValue, string> = {
  not_reviewed: "не проверено",
  in_review: "проверяется",
  reviewed: "проверено",
  needs_work: "требует доработки",
  needs_recheck: "требует повторной проверки",
  skipped: "пропущено",
};

export const reviewStatusSchema = z.object({
  id: reviewStatusIdSchema,
  studentId: studentIdSchema,
  projectId: projectIdSchema,
  updateEventId: updateEventIdSchema,
  status: reviewStatusValueSchema,
  createdAt: isoUtcDateSchema,
  updatedAt: isoUtcDateSchema,
});
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const commentSchema = z.object({
  id: commentIdSchema,
  studentId: studentIdSchema,
  projectId: projectIdSchema,
  updateEventId: updateEventIdSchema,
  text: z.string().trim().min(1, "Комментарий не может быть пустым."),
  basedOnAiReportId: aiReportIdSchema.nullable(),
  createdAt: isoUtcDateSchema,
  updatedAt: isoUtcDateSchema,
});
export type Comment = z.infer<typeof commentSchema>;

export const aiDescriptionSchema = z.object({
  status: z.enum(["missing", "running", "ready", "error"]),
  summary: z.string().nullable(),
  idea: z.string().nullable(),
  keyParts: z.array(z.string()),
  sourceAiReportId: aiReportIdSchema.nullable(),
  sourceCommit: z.string().nullable(),
  updatedAt: isoUtcDateSchema.nullable(),
  error: z.string().nullable(),
});

export const studentSchema = z.object({
  id: studentIdSchema,
  displayName: z.string().trim().min(1, "Имя студента обязательно."),
  notes: z.string().nullable(),
  projectId: projectIdSchema,
  createdAt: isoUtcDateSchema,
  updatedAt: isoUtcDateSchema,
});

export type Student = z.infer<typeof studentSchema>;

export const projectSchema = z.object({
  id: projectIdSchema,
  studentId: studentIdSchema,
  repositoryUrl: z.string().nullable(),
  localPath: z.string().nullable(),
  defaultBranch: z.literal("main"),
  currentBranch: z.string().nullable(),
  lastKnownCommit: z.string().nullable(),
  lastUpdatedAt: isoUtcDateSchema.nullable(),
  lastUpdateEventId: updateEventIdSchema.nullable(),
  status: projectStatusSchema,
  lastError: z.string().nullable(),
  aiDescription: aiDescriptionSchema,
  createdAt: isoUtcDateSchema,
  updatedAt: isoUtcDateSchema,
});

export type Project = z.infer<typeof projectSchema>;

export const toolDiagnosticsStatusSchema = z.enum([
  "unknown",
  "running",
  "success",
  "warning",
  "error",
]);

export const toolSettingsSchema = z.object({
  command: z.string().trim().min(1),
  status: toolDiagnosticsStatusSchema,
  version: z.string().nullable(),
  message: z.string().nullable(),
  checkedAt: isoUtcDateSchema.nullable(),
});

export const settingsSchema = z.object({
  dataRoot: z.literal("data"),
  appDataPath: z.literal("app"),
  repositoriesPath: z.literal("repositories"),
  reviewCopiesPath: z.literal("review-copies"),
  backupsPath: z.literal("backups"),
  tools: z.object({
    git: toolSettingsSchema,
    gh: toolSettingsSchema,
    codex: toolSettingsSchema,
    code: toolSettingsSchema,
  }),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const studentsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  students: z.array(studentSchema),
});

export type StudentsFile = z.infer<typeof studentsFileSchema>;

export const projectsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projects: z.array(projectSchema),
});

export type ProjectsFile = z.infer<typeof projectsFileSchema>;

export const updateRunsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updateRuns: z.array(updateRunSchema),
});

export type UpdateRunsFile = z.infer<typeof updateRunsFileSchema>;

export const updateEventsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updateEvents: z.array(updateEventSchema),
});

export type UpdateEventsFile = z.infer<typeof updateEventsFileSchema>;

export const commentsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  comments: z.array(commentSchema),
});

export type CommentsFile = z.infer<typeof commentsFileSchema>;

export const reviewStatusesFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  reviewStatuses: z.array(reviewStatusSchema),
});

export type ReviewStatusesFile = z.infer<typeof reviewStatusesFileSchema>;

export const aiReportsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  aiReports: z.array(z.record(z.string(), z.unknown())),
});

export type AiReportsFile = z.infer<typeof aiReportsFileSchema>;

export const settingsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  settings: settingsSchema,
});

export type SettingsFile = z.infer<typeof settingsFileSchema>;

export type AppData = {
  studentsFile: StudentsFile;
  projectsFile: ProjectsFile;
  updateRunsFile: UpdateRunsFile;
  updateEventsFile: UpdateEventsFile;
  commentsFile: CommentsFile;
  reviewStatusesFile: ReviewStatusesFile;
  aiReportsFile: AiReportsFile;
  settingsFile: SettingsFile;
};
