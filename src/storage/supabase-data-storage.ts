import { resolve } from "node:path";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  SupabaseConfigurationError,
  createSupabaseServerClientFromEnv,
} from "@/integrations/supabase";
import {
  aiAnalysisJobStatusSchema,
  aiAnalysisModeSchema,
  aiPullRequestContextSchema,
  aiReportStatusSchema,
  projectStatusSchema,
  reviewStatusValueSchema,
  type AiPullRequestContext,
  type AiReport,
  type AppData,
  type Project,
  type SettingsFile,
  type UpdateEvent,
  updateEventResultSchema,
  updateEventStatusSchema,
  updateRunScopeSchema,
  updateRunStatusSchema,
  updateRunSummarySchema,
} from "@/domain/schemas";
import { pathExists } from "./file-system";
import { createStorageError } from "./storage-error";

export type SupabaseDataFileKey = Exclude<keyof AppData, "settingsFile">;

type SupabaseDataStorageOptions = {
  client?: SupabaseClient;
  dataRootPath: string;
};

const studentRowSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const projectRowSchema = z.object({
  id: z.string(),
  student_id: z.string(),
  repository_url: z.string().nullable(),
  default_branch: z.literal("main"),
  current_branch: z.string().nullable(),
  last_known_commit: z.string().nullable(),
  last_updated_at: z.string().nullable(),
  last_update_event_id: z.string().nullable(),
  status: projectStatusSchema,
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const updateRunRowSchema = z.object({
  id: z.string(),
  scope: updateRunScopeSchema,
  student_id: z.string().nullable(),
  project_id: z.string().nullable(),
  status: updateRunStatusSchema,
  started_at: z.string(),
  finished_at: z.string().nullable(),
  summary: updateRunSummarySchema,
  error: z.string().nullable(),
});

const updateEventRowSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  student_id: z.string(),
  project_id: z.string(),
  status: updateEventStatusSchema,
  started_at: z.string(),
  finished_at: z.string().nullable(),
  occurred_at: z.string().nullable(),
  repository_url_snapshot: z.string().nullable(),
  local_path_snapshot: z.string().nullable(),
  branch: z.literal("main"),
  previous_commit: z.string().nullable(),
  new_commit: z.string().nullable(),
  new_commits_count: z.number().int().nonnegative().nullable(),
  has_changes: z.boolean(),
  result: updateEventResultSchema.nullable(),
  error: z.string().nullable(),
  analysis_boundary_recorded_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const reviewStatusRowSchema = z.object({
  id: z.string(),
  update_event_id: z.string(),
  status: reviewStatusValueSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

const commentRowSchema = z.object({
  id: z.string(),
  update_event_id: z.string(),
  student_id: z.string(),
  project_id: z.string(),
  body: z.string(),
  based_on_ai_report_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const aiAnalysisJobRowSchema = z.object({
  id: z.string(),
  update_event_id: z.string(),
  student_id: z.string(),
  project_id: z.string(),
  status: aiAnalysisJobStatusSchema,
  queued_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  ai_report_id: z.string().nullable(),
  attempt_count: z.number().int().nonnegative(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const jsonRecordSchema = z.record(z.string(), z.unknown());
const stringArraySchema = z.array(z.string());

const aiReportRowSchema = z.object({
  id: z.string(),
  update_event_id: z.string(),
  student_id: z.string(),
  project_id: z.string(),
  status: aiReportStatusSchema,
  analysis_mode: aiAnalysisModeSchema,
  previous_commit: z.string().nullable(),
  new_commit: z.string(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  summary: z.string().nullable(),
  functionality_summary: z.string().nullable(),
  manual_check_items: z.unknown(),
  questions: z.unknown(),
  draft_comment: z.string().nullable(),
  full_text: z.string().nullable(),
  structured_result: jsonRecordSchema,
  technical_details: jsonRecordSchema,
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const projectAiDescriptionRowSchema = z.object({
  project_id: z.string(),
  status: z.enum(["missing", "running", "ready", "error"]),
  summary: z.string().nullable(),
  idea: z.string().nullable(),
  key_parts: z.unknown(),
  source_ai_report_id: z.string().nullable(),
  source_commit: z.string().nullable(),
  error: z.string().nullable(),
  updated_at: z.string(),
});

const defaultPullRequestContext: AiPullRequestContext = {
  status: "not_requested",
  number: null,
  title: null,
  url: null,
  state: null,
  error: null,
};

export class SupabaseDataStorage {
  private readonly providedClient: SupabaseClient | null;
  private readonly dataRootPath: string;
  private client: SupabaseClient | null = null;

  constructor(options: SupabaseDataStorageOptions) {
    this.providedClient = options.client ?? null;
    this.dataRootPath = options.dataRootPath;
  }

  async load(settingsFile: SettingsFile): Promise<AppData> {
    const [
      students,
      projects,
      updateRuns,
      updateEvents,
      reviewStatuses,
      comments,
      aiAnalysisJobs,
      aiReports,
      projectAiDescriptions,
    ] = await Promise.all([
      this.selectRows(
        "students",
        "id, display_name, notes, created_at, updated_at",
        studentRowSchema,
      ),
      this.selectRows(
        "projects",
        [
          "id",
          "student_id",
          "repository_url",
          "default_branch",
          "current_branch",
          "last_known_commit",
          "last_updated_at",
          "last_update_event_id",
          "status",
          "last_error",
          "created_at",
          "updated_at",
        ].join(", "),
        projectRowSchema,
      ),
      this.selectRows(
        "update_runs",
        "id, scope, student_id, project_id, status, started_at, finished_at, summary, error",
        updateRunRowSchema,
      ),
      this.selectRows(
        "update_events",
        [
          "id",
          "run_id",
          "student_id",
          "project_id",
          "status",
          "started_at",
          "finished_at",
          "occurred_at",
          "repository_url_snapshot",
          "local_path_snapshot",
          "branch",
          "previous_commit",
          "new_commit",
          "new_commits_count",
          "has_changes",
          "result",
          "error",
          "analysis_boundary_recorded_at",
          "created_at",
          "updated_at",
        ].join(", "),
        updateEventRowSchema,
      ),
      this.selectRows(
        "review_statuses",
        "id, update_event_id, status, created_at, updated_at",
        reviewStatusRowSchema,
      ),
      this.selectRows(
        "comments",
        "id, update_event_id, student_id, project_id, body, based_on_ai_report_id, created_at, updated_at",
        commentRowSchema,
      ),
      this.selectRows(
        "ai_analysis_jobs",
        [
          "id",
          "update_event_id",
          "student_id",
          "project_id",
          "status",
          "queued_at",
          "started_at",
          "finished_at",
          "ai_report_id",
          "attempt_count",
          "last_error",
          "created_at",
          "updated_at",
        ].join(", "),
        aiAnalysisJobRowSchema,
      ),
      this.selectRows(
        "ai_reports",
        [
          "id",
          "update_event_id",
          "student_id",
          "project_id",
          "status",
          "analysis_mode",
          "previous_commit",
          "new_commit",
          "started_at",
          "finished_at",
          "summary",
          "functionality_summary",
          "manual_check_items",
          "questions",
          "draft_comment",
          "full_text",
          "structured_result",
          "technical_details",
          "error",
          "created_at",
          "updated_at",
        ].join(", "),
        aiReportRowSchema,
      ),
      this.selectRows(
        "project_ai_descriptions",
        [
          "project_id",
          "status",
          "summary",
          "idea",
          "key_parts",
          "source_ai_report_id",
          "source_commit",
          "error",
          "updated_at",
        ].join(", "),
        projectAiDescriptionRowSchema,
      ),
    ]);

    const eventsById = new Map(updateEvents.map((event) => [event.id, event]));
    const descriptionsByProjectId = new Map(
      projectAiDescriptions.map((description) => [
        description.project_id,
        description,
      ]),
    );

    return {
      studentsFile: {
        schemaVersion: 1,
        students: students.map((student) => {
          const project = projects.find(
            (item) => item.student_id === student.id,
          );

          return {
            id: student.id,
            displayName: student.display_name,
            notes: student.notes,
            projectId:
              project?.id ?? `project_${student.id.replace(/^student_/, "")}`,
            createdAt: toIsoUtc(student.created_at),
            updatedAt: toIsoUtc(student.updated_at),
          };
        }),
      },
      projectsFile: {
        schemaVersion: 1,
        projects: await Promise.all(
          projects.map(async (project) => ({
            id: project.id,
            studentId: project.student_id,
            repositoryUrl: project.repository_url,
            localPath: await this.resolveProjectLocalPath(
              project.student_id,
              project.id,
            ),
            defaultBranch: project.default_branch,
            currentBranch: project.current_branch,
            lastKnownCommit: project.last_known_commit,
            lastUpdatedAt: toNullableIsoUtc(project.last_updated_at),
            lastUpdateEventId: project.last_update_event_id,
            status: project.status,
            lastError: project.last_error,
            aiDescription: toAiDescription(
              descriptionsByProjectId.get(project.id),
            ),
            createdAt: toIsoUtc(project.created_at),
            updatedAt: toIsoUtc(project.updated_at),
          })),
        ),
      },
      updateRunsFile: {
        schemaVersion: 1,
        updateRuns: updateRuns.map((run) => ({
          id: run.id,
          scope: run.scope,
          studentId: run.student_id,
          projectId: run.project_id,
          status: run.status,
          startedAt: toIsoUtc(run.started_at),
          finishedAt: toNullableIsoUtc(run.finished_at),
          summary: run.summary,
          error: run.error,
        })),
      },
      updateEventsFile: {
        schemaVersion: 1,
        updateEvents: updateEvents.map((event) => toUpdateEvent(event)),
      },
      commentsFile: {
        schemaVersion: 1,
        comments: comments.map((comment) => ({
          id: comment.id,
          studentId: comment.student_id,
          projectId: comment.project_id,
          updateEventId: comment.update_event_id,
          text: comment.body,
          basedOnAiReportId: comment.based_on_ai_report_id,
          createdAt: toIsoUtc(comment.created_at),
          updatedAt: toIsoUtc(comment.updated_at),
        })),
      },
      reviewStatusesFile: {
        schemaVersion: 1,
        reviewStatuses: reviewStatuses.map((status) => {
          const event = eventsById.get(status.update_event_id);

          return {
            id: status.id,
            studentId: event?.student_id ?? "",
            projectId: event?.project_id ?? "",
            updateEventId: status.update_event_id,
            status: status.status,
            createdAt: toIsoUtc(status.created_at),
            updatedAt: toIsoUtc(status.updated_at),
          };
        }),
      },
      aiAnalysisJobsFile: {
        schemaVersion: 1,
        aiAnalysisJobs: aiAnalysisJobs.map((job) => ({
          id: job.id,
          studentId: job.student_id,
          projectId: job.project_id,
          updateEventId: job.update_event_id,
          aiReportId: job.ai_report_id,
          status: job.status,
          attempts: job.attempt_count,
          requestedAt: toIsoUtc(job.queued_at),
          startedAt: toNullableIsoUtc(job.started_at),
          finishedAt: toNullableIsoUtc(job.finished_at),
          lastError: job.last_error,
          createdAt: toIsoUtc(job.created_at),
          updatedAt: toIsoUtc(job.updated_at),
        })),
      },
      aiReportsFile: {
        schemaVersion: 1,
        aiReports: aiReports.map((report) => toAiReport(report)),
      },
      settingsFile,
    };
  }

  async saveFiles(data: AppData, keys: SupabaseDataFileKey[]): Promise<void> {
    const keySet = new Set(keys);

    if (keySet.has("studentsFile")) {
      await this.upsertRows(
        "students",
        data.studentsFile.students.map((student) => ({
          id: student.id,
          display_name: student.displayName,
          notes: student.notes,
          created_at: student.createdAt,
          updated_at: student.updatedAt,
        })),
      );
    }

    if (keySet.has("projectsFile")) {
      await this.upsertRows(
        "projects",
        data.projectsFile.projects.map((project) => ({
          id: project.id,
          student_id: project.studentId,
          repository_url: project.repositoryUrl,
          default_branch: project.defaultBranch,
          current_branch: project.currentBranch,
          last_known_commit: project.lastKnownCommit,
          last_updated_at: project.lastUpdatedAt,
          last_update_event_id: project.lastUpdateEventId,
          status: project.status,
          last_error: project.lastError,
          created_at: project.createdAt,
          updated_at: project.updatedAt,
        })),
      );
    }

    if (keySet.has("updateRunsFile")) {
      await this.upsertRows(
        "update_runs",
        data.updateRunsFile.updateRuns.map((run) => ({
          id: run.id,
          scope: run.scope,
          student_id: run.studentId,
          project_id: run.projectId,
          status: run.status,
          started_at: run.startedAt,
          finished_at: run.finishedAt,
          summary: run.summary,
          error: run.error,
        })),
      );
    }

    if (keySet.has("updateEventsFile")) {
      await this.upsertRows(
        "update_events",
        data.updateEventsFile.updateEvents.map((event) => ({
          id: event.id,
          run_id: event.runId,
          student_id: event.studentId,
          project_id: event.projectId,
          status: event.status,
          started_at: event.startedAt,
          finished_at: event.finishedAt,
          occurred_at: event.occurredAt,
          repository_url_snapshot: event.repositoryUrlSnapshot,
          local_path_snapshot: event.projectLocalPathSnapshot,
          branch: event.branch,
          previous_commit: event.previousCommit,
          new_commit: event.newCommit,
          new_commits_count: event.newCommitsCount,
          has_changes: event.hasNewChanges,
          result: event.result,
          error: event.error,
          analysis_boundary_recorded_at: event.analysisBoundaryRecordedAt,
          created_at: event.createdAt,
          updated_at: event.updatedAt,
        })),
      );
    }

    if (keySet.has("reviewStatusesFile")) {
      await this.upsertRows(
        "review_statuses",
        data.reviewStatusesFile.reviewStatuses.map((status) => ({
          id: status.id,
          update_event_id: status.updateEventId,
          status: status.status,
          created_at: status.createdAt,
          updated_at: status.updatedAt,
        })),
      );
    }

    if (keySet.has("aiAnalysisJobsFile")) {
      await this.upsertRows(
        "ai_analysis_jobs",
        data.aiAnalysisJobsFile.aiAnalysisJobs.map((job) => ({
          id: job.id,
          update_event_id: job.updateEventId,
          student_id: job.studentId,
          project_id: job.projectId,
          status: job.status,
          queued_at: job.requestedAt,
          started_at: job.startedAt,
          finished_at: job.finishedAt,
          ai_report_id: null,
          attempt_count: job.attempts,
          last_error: job.lastError,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        })),
      );
    }

    if (keySet.has("aiReportsFile")) {
      const jobsByReportId = new Map(
        data.aiAnalysisJobsFile.aiAnalysisJobs
          .filter((job) => job.aiReportId !== null)
          .map((job) => [job.aiReportId, job.id]),
      );

      await this.upsertRows(
        "ai_reports",
        data.aiReportsFile.aiReports.map((report) => ({
          id: report.id,
          update_event_id: report.updateEventId,
          student_id: report.studentId,
          project_id: report.projectId,
          ai_job_id: jobsByReportId.get(report.id) ?? null,
          status: report.status,
          analysis_mode: report.analysisMode,
          previous_commit: report.previousCommit,
          new_commit: report.newCommit ?? "",
          started_at: report.startedAt,
          finished_at: report.finishedAt,
          summary: report.summary,
          functionality_summary: report.changes,
          manual_check_items: report.risks,
          questions: report.manualReviewQuestions,
          draft_comment: report.teacherCommentDraft,
          full_text: report.fullText,
          structured_result: {
            importantFiles: report.importantFiles,
            changes: report.changes,
            risks: report.risks,
            manualReviewQuestions: report.manualReviewQuestions,
            pullRequestContext: report.pullRequestContext,
          },
          technical_details: {
            text: report.technicalDetails,
            repositoryUrlSnapshot: report.repositoryUrlSnapshot,
            projectLocalPathSnapshot: report.projectLocalPathSnapshot,
            branch: report.branch,
          },
          error: report.error,
          created_at: report.createdAt,
          updated_at: report.updatedAt,
        })),
      );
    }

    if (keySet.has("projectsFile")) {
      await this.upsertRows(
        "project_ai_descriptions",
        data.projectsFile.projects.map((project) => ({
          id: toProjectDescriptionId(project.id),
          project_id: project.id,
          status: project.aiDescription.status,
          summary: project.aiDescription.summary,
          idea: project.aiDescription.idea,
          key_parts: project.aiDescription.keyParts,
          source_ai_report_id: project.aiDescription.sourceAiReportId,
          source_commit: project.aiDescription.sourceCommit,
          error: project.aiDescription.error,
          updated_at: project.aiDescription.updatedAt ?? project.updatedAt,
        })),
        "project_id",
      );
    }

    if (keySet.has("commentsFile")) {
      await this.upsertRows(
        "comments",
        data.commentsFile.comments.map((comment) => ({
          id: comment.id,
          update_event_id: comment.updateEventId,
          student_id: comment.studentId,
          project_id: comment.projectId,
          body: comment.text,
          based_on_ai_report_id: comment.basedOnAiReportId,
          created_at: comment.createdAt,
          updated_at: comment.updatedAt,
        })),
      );
    }

    if (keySet.has("aiAnalysisJobsFile")) {
      await this.upsertRows(
        "ai_analysis_jobs",
        data.aiAnalysisJobsFile.aiAnalysisJobs.map((job) => ({
          id: job.id,
          update_event_id: job.updateEventId,
          student_id: job.studentId,
          project_id: job.projectId,
          status: job.status,
          queued_at: job.requestedAt,
          started_at: job.startedAt,
          finished_at: job.finishedAt,
          ai_report_id: job.aiReportId,
          attempt_count: job.attempts,
          last_error: job.lastError,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        })),
      );
    }

    await this.deleteStaleRows(data, keySet);
  }

  private async resolveProjectLocalPath(
    studentId: string,
    projectId: string,
  ): Promise<string | null> {
    const relativePath = `repositories/${studentId}/${projectId}`;
    const absolutePath = resolve(this.dataRootPath, relativePath);

    return (await pathExists(absolutePath)) ? relativePath : null;
  }

  private async selectRows<T>(
    tableName: string,
    columns: string,
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const { data, error } = await this.getClient()
      .from(tableName)
      .select(columns);

    if (error !== null) {
      throwSupabaseError("supabase_read_error", tableName, error);
    }

    const parsed = schema.array().safeParse(data ?? []);

    if (!parsed.success) {
      throw createStorageError(
        "supabase_schema_error",
        "Данные Supabase не соответствуют ожидаемой схеме.",
        undefined,
        parsed.error.message,
      );
    }

    return parsed.data;
  }

  private async upsertRows(
    tableName: string,
    rows: Array<Record<string, unknown>>,
    onConflict?: string,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const { error } = await this.getClient()
      .from(tableName)
      .upsert(rows, onConflict === undefined ? undefined : { onConflict });

    if (error !== null) {
      throwSupabaseError("supabase_write_error", tableName, error);
    }
  }

  private async deleteStaleRows(
    data: AppData,
    keySet: Set<SupabaseDataFileKey>,
  ): Promise<void> {
    if (keySet.has("commentsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "comments",
        "id",
        data.commentsFile.comments.map((comment) => comment.id),
      );
    }

    if (keySet.has("projectsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "project_ai_descriptions",
        "project_id",
        data.projectsFile.projects.map((project) => project.id),
      );
    }

    if (keySet.has("aiAnalysisJobsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "ai_analysis_jobs",
        "id",
        data.aiAnalysisJobsFile.aiAnalysisJobs.map((job) => job.id),
      );
    }

    if (keySet.has("aiReportsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "ai_reports",
        "id",
        data.aiReportsFile.aiReports.map((report) => report.id),
      );
    }

    if (keySet.has("reviewStatusesFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "review_statuses",
        "id",
        data.reviewStatusesFile.reviewStatuses.map((status) => status.id),
      );
    }

    if (keySet.has("updateEventsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "update_events",
        "id",
        data.updateEventsFile.updateEvents.map((event) => event.id),
      );
    }

    if (keySet.has("updateRunsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "update_runs",
        "id",
        data.updateRunsFile.updateRuns.map((run) => run.id),
      );
    }

    if (keySet.has("projectsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "projects",
        "id",
        data.projectsFile.projects.map((project) => project.id),
      );
    }

    if (keySet.has("studentsFile")) {
      await this.deleteRowsMissingFromSnapshot(
        "students",
        "id",
        data.studentsFile.students.map((student) => student.id),
      );
    }
  }

  private async deleteRowsMissingFromSnapshot(
    tableName: string,
    idColumn: string,
    currentIds: string[],
  ): Promise<void> {
    const { data, error } = await this.getClient()
      .from(tableName)
      .select(idColumn);

    if (error !== null) {
      throwSupabaseError("supabase_read_error", tableName, error);
    }

    const rows = z.array(z.record(z.string(), z.unknown())).parse(data ?? []);
    const currentIdSet = new Set(currentIds);
    const staleIds = rows
      .map((row) => row[idColumn])
      .filter((value): value is string => typeof value === "string")
      .filter((id) => !currentIdSet.has(id));

    if (staleIds.length === 0) {
      return;
    }

    const deleteResult = await this.getClient()
      .from(tableName)
      .delete()
      .in(idColumn, staleIds);

    if (deleteResult.error !== null) {
      throwSupabaseError("supabase_write_error", tableName, deleteResult.error);
    }
  }

  private getClient(): SupabaseClient {
    if (this.client !== null) {
      return this.client;
    }

    try {
      this.client = this.providedClient ?? createSupabaseServerClientFromEnv();
      return this.client;
    } catch (error) {
      if (error instanceof SupabaseConfigurationError) {
        throw createStorageError(
          error.appError.code,
          error.appError.message,
          undefined,
          error.appError.details,
        );
      }

      throw error;
    }
  }
}

function toUpdateEvent(
  event: z.infer<typeof updateEventRowSchema>,
): UpdateEvent {
  return {
    id: event.id,
    runId: event.run_id,
    studentId: event.student_id,
    projectId: event.project_id,
    status: event.status,
    startedAt: toIsoUtc(event.started_at),
    finishedAt: toNullableIsoUtc(event.finished_at),
    occurredAt: toNullableIsoUtc(event.occurred_at),
    repositoryUrlSnapshot: event.repository_url_snapshot,
    projectLocalPathSnapshot: event.local_path_snapshot,
    branch: event.branch,
    previousCommit: event.previous_commit,
    newCommit: event.new_commit,
    newCommitsCount: event.new_commits_count,
    hasNewChanges: event.has_changes,
    result: event.result,
    error: event.error,
    analysisBoundaryRecordedAt: toNullableIsoUtc(
      event.analysis_boundary_recorded_at,
    ),
    createdAt: toIsoUtc(event.created_at),
    updatedAt: toIsoUtc(event.updated_at),
  };
}

function toAiReport(report: z.infer<typeof aiReportRowSchema>): AiReport {
  return {
    id: report.id,
    studentId: report.student_id,
    projectId: report.project_id,
    updateEventId: report.update_event_id,
    status: report.status,
    analysisMode: report.analysis_mode,
    startedAt: toIsoUtc(report.started_at),
    finishedAt: toNullableIsoUtc(report.finished_at),
    repositoryUrlSnapshot: readNullableString(
      report.technical_details,
      "repositoryUrlSnapshot",
    ),
    projectLocalPathSnapshot: readNullableString(
      report.technical_details,
      "projectLocalPathSnapshot",
    ),
    analysisPath: null,
    branch: readBranch(report.technical_details),
    previousCommit: report.previous_commit,
    newCommit: report.new_commit,
    summary: report.summary,
    importantFiles: readStringArray(report.structured_result, "importantFiles"),
    changes:
      readNullableString(report.structured_result, "changes") ??
      report.functionality_summary,
    risks: readStringArrayWithFallback(
      report.structured_result,
      "risks",
      report.manual_check_items,
    ),
    manualReviewQuestions: readStringArrayWithFallback(
      report.structured_result,
      "manualReviewQuestions",
      report.questions,
    ),
    teacherCommentDraft: report.draft_comment,
    fullText: report.full_text,
    pullRequestContext: readPullRequestContext(report.structured_result),
    technicalDetails: readNullableString(report.technical_details, "text"),
    error: report.error,
    createdAt: toIsoUtc(report.created_at),
    updatedAt: toIsoUtc(report.updated_at),
  };
}

function toAiDescription(
  row: z.infer<typeof projectAiDescriptionRowSchema> | undefined,
): Project["aiDescription"] {
  if (row === undefined) {
    return {
      status: "missing",
      summary: null,
      idea: null,
      keyParts: [],
      sourceAiReportId: null,
      sourceCommit: null,
      updatedAt: null,
      error: null,
    };
  }

  return {
    status: row.status,
    summary: row.summary,
    idea: row.idea,
    keyParts: parseStringArray(row.key_parts),
    sourceAiReportId: row.source_ai_report_id,
    sourceCommit: row.source_commit,
    updatedAt: toIsoUtc(row.updated_at),
    error: row.error,
  };
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  return parseStringArray(record[key]);
}

function readStringArrayWithFallback(
  record: Record<string, unknown>,
  key: string,
  fallback: unknown,
): string[] {
  const value = readStringArray(record, key);
  return value.length > 0 ? value : parseStringArray(fallback);
}

function parseStringArray(value: unknown): string[] {
  const parsed = stringArraySchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readBranch(record: Record<string, unknown>): "main" {
  return record.branch === "main" ? "main" : "main";
}

function readPullRequestContext(
  record: Record<string, unknown>,
): AiPullRequestContext {
  const parsed = aiPullRequestContextSchema.safeParse(
    record.pullRequestContext,
  );
  return parsed.success ? parsed.data : defaultPullRequestContext;
}

function toIsoUtc(value: string): string {
  return new Date(value).toISOString();
}

function toNullableIsoUtc(value: string | null): string | null {
  return value === null ? null : toIsoUtc(value);
}

function toProjectDescriptionId(projectId: string): string {
  return `project_description_${projectId.replace(/^project_/, "")}`;
}

function throwSupabaseError(
  code: string,
  tableName: string,
  error: PostgrestError,
): never {
  throw createStorageError(
    code,
    "Не удалось выполнить операцию с Supabase.",
    undefined,
    `${tableName}: ${error.message}`,
  );
}
