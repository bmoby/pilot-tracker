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
  updateRuns: z.array(z.record(z.string(), z.unknown())),
});

export type UpdateRunsFile = z.infer<typeof updateRunsFileSchema>;

export const updateEventsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updateEvents: z.array(z.record(z.string(), z.unknown())),
});

export type UpdateEventsFile = z.infer<typeof updateEventsFileSchema>;

export const commentsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  comments: z.array(z.record(z.string(), z.unknown())),
});

export type CommentsFile = z.infer<typeof commentsFileSchema>;

export const reviewStatusesFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  reviewStatuses: z.array(z.record(z.string(), z.unknown())),
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
