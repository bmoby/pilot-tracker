import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type Student = {
  id: string;
  displayName: string;
  notes: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  studentId: string;
  repositoryUrl: string | null;
  defaultBranch: "main";
  currentBranch: string | null;
  lastKnownCommit: string | null;
  lastUpdatedAt: string | null;
  lastUpdateEventId: string | null;
  status: string;
  lastError: string | null;
  aiDescription: {
    status: string;
    summary: string | null;
    idea: string | null;
    keyParts: string[];
    sourceAiReportId: string | null;
    sourceCommit: string | null;
    updatedAt: string | null;
    error: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

type UpdateRun = {
  id: string;
  scope: string;
  studentId: string | null;
  projectId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  summary: JsonRecord;
  error: string | null;
};

type UpdateEvent = {
  id: string;
  runId: string;
  studentId: string;
  projectId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  occurredAt: string | null;
  repositoryUrlSnapshot: string | null;
  projectLocalPathSnapshot: string | null;
  branch: "main";
  previousCommit: string | null;
  newCommit: string | null;
  newCommitsCount: number | null;
  hasNewChanges: boolean;
  result: string | null;
  error: string | null;
  analysisBoundaryRecordedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReviewStatus = {
  id: string;
  studentId: string;
  projectId: string;
  updateEventId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Comment = {
  id: string;
  studentId: string;
  projectId: string;
  updateEventId: string;
  text: string;
  basedOnAiReportId: string | null;
  createdAt: string;
  updatedAt: string;
};

type AiAnalysisJob = {
  id: string;
  studentId: string;
  projectId: string;
  updateEventId: string;
  aiReportId: string | null;
  status: string;
  attempts: number;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type AiReport = {
  id: string;
  studentId: string;
  projectId: string;
  updateEventId: string;
  status: string;
  analysisMode: string;
  startedAt: string;
  finishedAt: string | null;
  repositoryUrlSnapshot: string | null;
  projectLocalPathSnapshot: string | null;
  branch: "main";
  previousCommit: string | null;
  newCommit: string | null;
  summary: string | null;
  importantFiles: string[];
  changes: string | null;
  risks: string[];
  manualReviewQuestions: string[];
  teacherCommentDraft: string | null;
  fullText: string | null;
  pullRequestContext: JsonRecord;
  technicalDetails: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type AppDataSnapshot = {
  studentsFile: { students: Student[] };
  projectsFile: { projects: Project[] };
  updateRunsFile: { updateRuns: UpdateRun[] };
  updateEventsFile: { updateEvents: UpdateEvent[] };
  commentsFile: { comments: Comment[] };
  reviewStatusesFile: { reviewStatuses: ReviewStatus[] };
  aiAnalysisJobsFile: { aiAnalysisJobs: AiAnalysisJob[] };
  aiReportsFile: { aiReports: AiReport[] };
};

const appDataPath = resolve(process.cwd(), "data", "app");
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldReplace = args.has("--replace");

if (args.has("--help")) {
  console.log(
    [
      "Миграция локальных JSON-данных Pilot Tracker в онлайн-проект Supabase.",
      "",
      "Команды:",
      "  pnpm migrate:json-to-supabase",
      "  pnpm migrate:json-to-supabase -- --write",
      "  pnpm migrate:json-to-supabase -- --write --replace",
      "",
      "По умолчанию выполняется пробный режим без записи.",
      "--write записывает данные через upsert.",
      "--replace после записи удаляет из Supabase строки, которых нет в JSON-снимке.",
    ].join("\n"),
  );
  process.exit(0);
}

if (shouldReplace && !shouldWrite) {
  throw new Error("Флаг --replace можно использовать только вместе с --write.");
}

const data = await loadAppDataSnapshot();
validateSnapshot(data);

const rowsByTable = buildRowsByTable(data);
const expectedCounts = getExpectedCounts(rowsByTable);

printCounts("Локальный JSON-снимок готов к миграции:", expectedCounts);

if (!shouldWrite) {
  console.log("Пробный режим завершен. Запись в Supabase не выполнялась.");
  process.exit(0);
}

const supabase = createSupabaseClientFromEnv();

await writeSnapshot(supabase, rowsByTable);

if (shouldReplace) {
  await deleteStaleRows(supabase, rowsByTable);
}

const onlineCounts = await countOnlineRows(supabase, Object.keys(rowsByTable));
printCounts("Текущее количество строк в Supabase:", onlineCounts);
printCountComparison(expectedCounts, onlineCounts);

async function loadAppDataSnapshot(): Promise<AppDataSnapshot> {
  const [
    studentsFile,
    projectsFile,
    updateRunsFile,
    updateEventsFile,
    commentsFile,
    reviewStatusesFile,
    aiAnalysisJobsFile,
    aiReportsFile,
  ] = await Promise.all([
    readJsonFile<AppDataSnapshot["studentsFile"]>("students.json"),
    readJsonFile<AppDataSnapshot["projectsFile"]>("projects.json"),
    readJsonFile<AppDataSnapshot["updateRunsFile"]>("update-runs.json"),
    readJsonFile<AppDataSnapshot["updateEventsFile"]>("update-events.json"),
    readJsonFile<AppDataSnapshot["commentsFile"]>("comments.json"),
    readJsonFile<AppDataSnapshot["reviewStatusesFile"]>("review-statuses.json"),
    readJsonFile<AppDataSnapshot["aiAnalysisJobsFile"]>(
      "ai-analysis-jobs.json",
    ),
    readJsonFile<AppDataSnapshot["aiReportsFile"]>("ai-reports.json"),
  ]);

  return {
    studentsFile,
    projectsFile,
    updateRunsFile,
    updateEventsFile,
    commentsFile,
    reviewStatusesFile,
    aiAnalysisJobsFile,
    aiReportsFile,
  };
}

async function readJsonFile<T>(fileName: string): Promise<T> {
  const content = await readFile(resolve(appDataPath, fileName), "utf8");
  return JSON.parse(content) as T;
}

function validateSnapshot(data: AppDataSnapshot): void {
  const studentIds = new Set(
    data.studentsFile.students.map((student) => student.id),
  );
  const projectIds = new Set(
    data.projectsFile.projects.map((project) => project.id),
  );
  const runIds = new Set(data.updateRunsFile.updateRuns.map((run) => run.id));
  const eventIds = new Set(
    data.updateEventsFile.updateEvents.map((event) => event.id),
  );
  const reportIds = new Set(
    data.aiReportsFile.aiReports.map((report) => report.id),
  );

  assertUnique(
    "студентах",
    data.studentsFile.students.map((student) => student.id),
  );
  assertUnique(
    "проектах",
    data.projectsFile.projects.map((project) => project.id),
  );
  assertUnique(
    "запусках обновления",
    data.updateRunsFile.updateRuns.map((run) => run.id),
  );
  assertUnique(
    "событиях обновления",
    data.updateEventsFile.updateEvents.map((event) => event.id),
  );
  assertUnique(
    "статусах проверки",
    data.reviewStatusesFile.reviewStatuses.map((status) => status.id),
  );
  assertUnique(
    "комментариях",
    data.commentsFile.comments.map((comment) => comment.id),
  );
  assertUnique(
    "заданиях ИИ-анализа",
    data.aiAnalysisJobsFile.aiAnalysisJobs.map((job) => job.id),
  );
  assertUnique(
    "ИИ-рапортах",
    data.aiReportsFile.aiReports.map((report) => report.id),
  );

  for (const student of data.studentsFile.students) {
    const project = data.projectsFile.projects.find(
      (item) => item.id === student.projectId,
    );

    if (project === undefined || project.studentId !== student.id) {
      throw new Error(`Нарушена связь студента и проекта: ${student.id}.`);
    }
  }

  for (const event of data.updateEventsFile.updateEvents) {
    if (
      !runIds.has(event.runId) ||
      !studentIds.has(event.studentId) ||
      !projectIds.has(event.projectId)
    ) {
      throw new Error(
        `Событие обновления ссылается на отсутствующие данные: ${event.id}.`,
      );
    }
  }

  for (const status of data.reviewStatusesFile.reviewStatuses) {
    if (!eventIds.has(status.updateEventId)) {
      throw new Error(
        `Статус проверки ссылается на отсутствующее событие: ${status.id}.`,
      );
    }
  }

  for (const comment of data.commentsFile.comments) {
    if (!eventIds.has(comment.updateEventId)) {
      throw new Error(
        `Комментарий ссылается на отсутствующее событие: ${comment.id}.`,
      );
    }

    if (
      comment.basedOnAiReportId !== null &&
      !reportIds.has(comment.basedOnAiReportId)
    ) {
      throw new Error(
        `Комментарий ссылается на отсутствующий ИИ-рапорт: ${comment.id}.`,
      );
    }
  }

  for (const job of data.aiAnalysisJobsFile.aiAnalysisJobs) {
    if (!eventIds.has(job.updateEventId)) {
      throw new Error(
        `Задание ИИ-анализа ссылается на отсутствующее событие: ${job.id}.`,
      );
    }

    if (job.aiReportId !== null && !reportIds.has(job.aiReportId)) {
      throw new Error(
        `Задание ИИ-анализа ссылается на отсутствующий ИИ-рапорт: ${job.id}.`,
      );
    }
  }

  for (const report of data.aiReportsFile.aiReports) {
    if (!eventIds.has(report.updateEventId)) {
      throw new Error(
        `ИИ-рапорт ссылается на отсутствующее событие: ${report.id}.`,
      );
    }
  }
}

function assertUnique(label: string, ids: string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`В ${label} найдены повторяющиеся идентификаторы.`);
  }
}

function buildRowsByTable(data: AppDataSnapshot): Record<string, JsonRecord[]> {
  const jobsByReportId = new Map(
    data.aiAnalysisJobsFile.aiAnalysisJobs
      .filter((job) => job.aiReportId !== null)
      .map((job) => [job.aiReportId, job.id]),
  );

  return {
    students: data.studentsFile.students.map((student) => ({
      id: student.id,
      display_name: student.displayName,
      notes: student.notes,
      created_at: student.createdAt,
      updated_at: student.updatedAt,
    })),
    projects: data.projectsFile.projects.map((project) => ({
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
    update_runs: data.updateRunsFile.updateRuns.map((run) => ({
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
    update_events: data.updateEventsFile.updateEvents.map((event) => ({
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
    review_statuses: data.reviewStatusesFile.reviewStatuses.map((status) => ({
      id: status.id,
      update_event_id: status.updateEventId,
      status: status.status,
      created_at: status.createdAt,
      updated_at: status.updatedAt,
    })),
    ai_analysis_jobs: data.aiAnalysisJobsFile.aiAnalysisJobs.map((job) => ({
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
    ai_reports: data.aiReportsFile.aiReports.map((report) => ({
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
    project_ai_descriptions: data.projectsFile.projects.map((project) => ({
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
    comments: data.commentsFile.comments.map((comment) => ({
      id: comment.id,
      update_event_id: comment.updateEventId,
      student_id: comment.studentId,
      project_id: comment.projectId,
      body: comment.text,
      based_on_ai_report_id: comment.basedOnAiReportId,
      created_at: comment.createdAt,
      updated_at: comment.updatedAt,
    })),
  };
}

function createSupabaseClientFromEnv(): SupabaseClient {
  const url = process.env.PILOT_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey =
    process.env.PILOT_SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (url === "" || serviceRoleKey === "") {
    throw new Error(
      "Заполните PILOT_SUPABASE_URL и PILOT_SUPABASE_SERVICE_ROLE_KEY в локальном .env-файле.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function writeSnapshot(
  supabase: SupabaseClient,
  rowsByTable: Record<string, JsonRecord[]>,
): Promise<void> {
  await upsertRows(supabase, "students", rowsByTable.students ?? []);
  await upsertRows(supabase, "projects", rowsByTable.projects ?? []);
  await upsertRows(supabase, "update_runs", rowsByTable.update_runs ?? []);
  await upsertRows(supabase, "update_events", rowsByTable.update_events ?? []);
  await upsertRows(
    supabase,
    "review_statuses",
    rowsByTable.review_statuses ?? [],
  );
  await upsertRows(
    supabase,
    "ai_analysis_jobs",
    (rowsByTable.ai_analysis_jobs ?? []).map((row) => ({
      ...row,
      ai_report_id: null,
    })),
  );
  await upsertRows(supabase, "ai_reports", rowsByTable.ai_reports ?? []);
  await upsertRows(
    supabase,
    "project_ai_descriptions",
    rowsByTable.project_ai_descriptions ?? [],
    "project_id",
  );
  await upsertRows(supabase, "comments", rowsByTable.comments ?? []);
  await upsertRows(
    supabase,
    "ai_analysis_jobs",
    rowsByTable.ai_analysis_jobs ?? [],
  );
}

async function upsertRows(
  supabase: SupabaseClient,
  tableName: string,
  rows: JsonRecord[],
  onConflict?: string,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from(tableName)
    .upsert(rows, onConflict === undefined ? undefined : { onConflict });

  if (error !== null) {
    throw new Error(`Не удалось записать ${tableName}: ${error.message}`);
  }
}

async function deleteStaleRows(
  supabase: SupabaseClient,
  rowsByTable: Record<string, JsonRecord[]>,
): Promise<void> {
  await deleteRowsMissingFromSnapshot(
    supabase,
    "comments",
    "id",
    rowsByTable.comments ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "project_ai_descriptions",
    "project_id",
    rowsByTable.project_ai_descriptions ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "ai_analysis_jobs",
    "id",
    rowsByTable.ai_analysis_jobs ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "ai_reports",
    "id",
    rowsByTable.ai_reports ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "review_statuses",
    "id",
    rowsByTable.review_statuses ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "update_events",
    "id",
    rowsByTable.update_events ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "update_runs",
    "id",
    rowsByTable.update_runs ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "projects",
    "id",
    rowsByTable.projects ?? [],
  );
  await deleteRowsMissingFromSnapshot(
    supabase,
    "students",
    "id",
    rowsByTable.students ?? [],
  );
}

async function deleteRowsMissingFromSnapshot(
  supabase: SupabaseClient,
  tableName: string,
  idColumn: string,
  rows: JsonRecord[],
): Promise<void> {
  const { data, error } = await supabase.from(tableName).select(idColumn);

  if (error !== null) {
    throw new Error(`Не удалось прочитать ${tableName}: ${error.message}`);
  }

  const currentIds = new Set(
    rows
      .map((row) => row[idColumn])
      .filter((value): value is string => typeof value === "string"),
  );
  const existingRows = (data ?? []) as unknown as JsonRecord[];
  const staleIds = existingRows
    .map((row) => row[idColumn])
    .filter((value): value is string => typeof value === "string")
    .filter((id) => !currentIds.has(id));

  if (staleIds.length === 0) {
    return;
  }

  const deleteResult = await supabase
    .from(tableName)
    .delete()
    .in(idColumn, staleIds);

  if (deleteResult.error !== null) {
    throw new Error(
      `Не удалось удалить старые строки ${tableName}: ${deleteResult.error.message}`,
    );
  }
}

async function countOnlineRows(
  supabase: SupabaseClient,
  tableNames: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const tableName of tableNames) {
    const { count, error } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    if (error !== null) {
      throw new Error(`Не удалось посчитать ${tableName}: ${error.message}`);
    }

    counts[tableName] = count ?? 0;
  }

  return counts;
}

function getExpectedCounts(
  rowsByTable: Record<string, JsonRecord[]>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(rowsByTable).map(([tableName, rows]) => [
      tableName,
      rows.length,
    ]),
  );
}

function printCounts(title: string, counts: Record<string, number>): void {
  console.log(title);

  for (const [tableName, count] of Object.entries(counts)) {
    console.log(`- ${tableName}: ${count}`);
  }
}

function printCountComparison(
  expectedCounts: Record<string, number>,
  onlineCounts: Record<string, number>,
): void {
  const mismatches = Object.entries(expectedCounts).filter(
    ([tableName, expected]) => onlineCounts[tableName] !== expected,
  );

  if (mismatches.length === 0) {
    console.log(
      "Количество строк Supabase совпадает с локальным JSON-снимком.",
    );
    return;
  }

  console.log(
    "Количество строк Supabase отличается от локального JSON-снимка:",
  );

  for (const [tableName, expected] of mismatches) {
    console.log(
      `- ${tableName}: ожидалось ${expected}, сейчас ${onlineCounts[tableName] ?? 0}`,
    );
  }
}

function toProjectDescriptionId(projectId: string): string {
  return `project_description_${projectId.replace(/^project_/, "")}`;
}
