import { dirname, isAbsolute, relative, resolve } from "node:path";
import type {
  AppData,
  AiPullRequestContext,
  AiReport,
  Comment,
  Project,
  ReviewStatus,
  ReviewStatusValue,
  Student,
  UpdateEvent,
  UpdateRun,
} from "@/domain/schemas";
import {
  projectStatusLabels,
  reviewStatusLabels,
  updateEventResultLabels,
  type UpdateRunSummary,
} from "@/domain/schemas";
import {
  createUtcTimestamp,
  isGithubRepositoryUrl,
} from "@/domain/student-rules";
import {
  applyEventToProject,
  completeUpdateEvent,
  createInitialReviewStatus,
  createRunningUpdateEvent,
  createUpdateRun,
  getProjectStatusForError,
  getRunStatusFromSummary,
  summarizeUpdateEvents,
  type GitUpdateError,
  type GitUpdateErrorCategory,
} from "@/domain/update-rules";
import {
  GitCliClient,
  GitCommandError,
  type GitProjectClient,
} from "@/integrations/git";
import {
  failure,
  normalizeUnknownError,
  success,
  type AppError,
  type AppResult,
} from "@/shared/result";
import { AppStorage, getDefaultStorage } from "@/storage/app-storage";
import { ensureDirectory, pathExists } from "@/storage/file-system";
import { StorageError } from "@/storage/storage-error";

export type UpdateRunListItem = {
  id: string;
  scope: UpdateRun["scope"];
  status: UpdateRun["status"];
  startedAt: string;
  finishedAt: string | null;
  summary: UpdateRunSummary;
  error: string | null;
};

export type ReviewCommentListItem = {
  id: string;
  text: string;
  basedOnAiReportId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiReportListItem = {
  id: string;
  status: AiReport["status"];
  analysisMode: AiReport["analysisMode"];
  startedAt: string;
  finishedAt: string | null;
  previousCommit: string | null;
  newCommit: string | null;
  summary: string | null;
  importantFiles: string[];
  changes: string | null;
  risks: string[];
  manualReviewQuestions: string[];
  teacherCommentDraft: string | null;
  fullText: string | null;
  pullRequestContext: AiPullRequestContext;
  technicalDetails: string | null;
  error: string | null;
};

export type UpdateEventListItem = {
  id: string;
  result: UpdateEvent["result"];
  resultLabel: string;
  status: UpdateEvent["status"];
  reviewStatus: ReviewStatusValue;
  reviewStatusLabel: string;
  commentsCount: number;
  comments: ReviewCommentListItem[];
  aiReportsCount: number;
  aiReports: AiReportListItem[];
  aiAnalysisDisabledReason: string | null;
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
  error: string | null;
};

export type StudentDetailsData = {
  student: {
    id: string;
    displayName: string;
    notes: string | null;
  };
  project: {
    id: string;
    repositoryUrl: string | null;
    localPath: string | null;
    defaultBranch: "main";
    currentBranch: string | null;
    lastKnownCommit: string | null;
    lastUpdatedAt: string | null;
    lastError: string | null;
    status: Project["status"];
    statusLabel: string;
    aiDescriptionStatus: Project["aiDescription"]["status"];
    aiDescriptionSummary: string | null;
  };
  events: UpdateEventListItem[];
};

export type ProjectUpdateResponse = {
  run: UpdateRunListItem;
};

export async function updateAllProjects(
  storage = getDefaultStorage(),
  gitClient?: GitProjectClient,
): Promise<AppResult<ProjectUpdateResponse>> {
  try {
    const data = await storage.load();
    const now = createUtcTimestamp();
    const run = createUpdateRun({
      scope: "all_projects",
      studentId: null,
      projectId: null,
      studentsTotal: data.studentsFile.students.length,
      now,
    });

    data.updateRunsFile.updateRuns.push(run);
    await storage.saveFiles(data, ["updateRunsFile"]);

    const git = gitClient ?? createGitClient(data);
    const events: UpdateEvent[] = [];

    for (const student of data.studentsFile.students) {
      const project = findProject(data, student.projectId);

      if (project === null) {
        continue;
      }

      const event = await updateProject({
        storage,
        data,
        git,
        run,
        student,
        project,
      });
      events.push(event);
    }

    finishRun(run, events, data.studentsFile.students.length);
    await storage.saveFiles(data, ["updateRunsFile"]);

    return success({
      run: toUpdateRunListItem(run),
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function updateSingleProject(
  studentId: string,
  storage = getDefaultStorage(),
  gitClient?: GitProjectClient,
): Promise<AppResult<ProjectUpdateResponse>> {
  try {
    const data = await storage.load();
    const student = findStudent(data, studentId);

    if (student === null) {
      return failure({
        code: "student_not_found",
        message: "Студент не найден.",
      });
    }

    const project = findProject(data, student.projectId);

    if (project === null) {
      return failure({
        code: "project_not_found",
        message: "Связанный проект студента не найден.",
      });
    }

    if (project.repositoryUrl === null) {
      return failure({
        code: "repository_not_connected",
        message:
          "Проект не подключен: сначала добавьте GitHub-ссылку студента.",
      });
    }

    const now = createUtcTimestamp();
    const run = createUpdateRun({
      scope: "single_project",
      studentId: student.id,
      projectId: project.id,
      studentsTotal: 1,
      now,
    });

    data.updateRunsFile.updateRuns.push(run);
    await storage.saveFiles(data, ["updateRunsFile"]);

    const git = gitClient ?? createGitClient(data);
    const event = await updateProject({
      storage,
      data,
      git,
      run,
      student,
      project,
    });
    finishRun(run, [event], 1);
    await storage.saveFiles(data, ["updateRunsFile"]);

    return success({
      run: toUpdateRunListItem(run),
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function getStudentDetails(
  studentId: string,
  storage = getDefaultStorage(),
): Promise<AppResult<StudentDetailsData>> {
  try {
    const data = await storage.load();
    const student = findStudent(data, studentId);

    if (student === null) {
      return failure({
        code: "student_not_found",
        message: "Студент не найден.",
      });
    }

    const project = findProject(data, student.projectId);

    if (project === null) {
      return failure({
        code: "project_not_found",
        message: "Связанный проект студента не найден.",
      });
    }

    return success(toStudentDetailsData(data, student, project));
  } catch (error) {
    return failure(toAppError(error));
  }
}

export function getLatestUpdateRun(data: AppData): UpdateRunListItem | null {
  const run = [...data.updateRunsFile.updateRuns].sort((left, right) =>
    right.startedAt.localeCompare(left.startedAt),
  )[0];

  return run === undefined ? null : toUpdateRunListItem(run);
}

async function updateProject({
  storage,
  data,
  git,
  run,
  student,
  project,
}: {
  storage: AppStorage;
  data: AppData;
  git: GitProjectClient;
  run: UpdateRun;
  student: Student;
  project: Project;
}): Promise<UpdateEvent> {
  const startedAt = createUtcTimestamp();
  const event = createRunningUpdateEvent({
    runId: run.id,
    student,
    project,
    now: startedAt,
  });
  data.updateEventsFile.updateEvents.push(event);
  project.status = "updating";
  project.updatedAt = startedAt;
  await storage.saveFiles(data, ["projectsFile", "updateEventsFile"]);

  const outcome = await runProjectGitUpdate({ storage, git, project });
  const finishedAt = createUtcTimestamp();

  if (outcome.type === "skipped") {
    completeUpdateEvent({
      event,
      result: "skipped_no_repository",
      now: finishedAt,
      localPath: project.localPath,
      previousCommit: project.lastKnownCommit,
      newCommit: null,
      newCommitsCount: null,
      hasNewChanges: false,
      error: "GitHub-ссылка не указана.",
    });
    applyEventToProject({
      project,
      event,
      status: "not_connected",
      now: finishedAt,
      localPath: project.localPath,
      currentBranch: project.currentBranch,
      lastKnownCommit: project.lastKnownCommit,
      lastError: null,
    });
  } else if (outcome.type === "error") {
    completeUpdateEvent({
      event,
      result: "error",
      now: finishedAt,
      localPath: project.localPath,
      previousCommit: project.lastKnownCommit,
      newCommit: null,
      newCommitsCount: null,
      hasNewChanges: false,
      error: outcome.error.message,
    });
    applyEventToProject({
      project,
      event,
      status: getProjectStatusForError(outcome.error.category),
      now: finishedAt,
      localPath: project.localPath,
      currentBranch: project.currentBranch,
      lastKnownCommit: project.lastKnownCommit,
      lastError: outcome.error.message,
    });
  } else {
    completeUpdateEvent({
      event,
      result: outcome.result,
      now: finishedAt,
      localPath: outcome.localPath,
      previousCommit: outcome.previousCommit,
      newCommit: outcome.newCommit,
      newCommitsCount: outcome.newCommitsCount,
      hasNewChanges: outcome.hasNewChanges,
      error: null,
    });
    applyEventToProject({
      project,
      event,
      status: outcome.projectStatus,
      now: finishedAt,
      localPath: outcome.localPath,
      currentBranch: "main",
      lastKnownCommit: outcome.newCommit,
      lastError: null,
    });
  }

  const reviewStatus = createInitialReviewStatus(event, finishedAt);
  data.reviewStatusesFile.reviewStatuses.push(reviewStatus);
  await storage.saveFiles(data, [
    "projectsFile",
    "updateEventsFile",
    "reviewStatusesFile",
  ]);

  return event;
}

type ProjectGitUpdateOutcome =
  | {
      type: "skipped";
    }
  | {
      type: "error";
      error: GitUpdateError;
    }
  | {
      type: "success";
      result: "cloned" | "updated_with_changes" | "updated_no_changes";
      localPath: string;
      previousCommit: string | null;
      newCommit: string;
      newCommitsCount: number | null;
      hasNewChanges: boolean;
      projectStatus: Project["status"];
    };

async function runProjectGitUpdate({
  storage,
  git,
  project,
}: {
  storage: AppStorage;
  git: GitProjectClient;
  project: Project;
}): Promise<ProjectGitUpdateOutcome> {
  const repositoryUrl = project.repositoryUrl;

  if (repositoryUrl === null) {
    return { type: "skipped" };
  }

  if (!isGithubRepositoryUrl(repositoryUrl)) {
    return {
      type: "error",
      error: {
        category: "repo_url_invalid",
        message: "Ссылка GitHub не похожа на допустимый репозиторий.",
      },
    };
  }

  if (project.localPath === null) {
    return cloneProject({ storage, git, project, repositoryUrl });
  }

  return updateExistingProject({ storage, git, project });
}

async function cloneProject({
  storage,
  git,
  project,
  repositoryUrl,
}: {
  storage: AppStorage;
  git: GitProjectClient;
  project: Project;
  repositoryUrl: string;
}): Promise<ProjectGitUpdateOutcome> {
  const localPath = getProjectRelativePath(project);
  const absolutePath = resolveDataPath(storage, localPath);

  if (await pathExists(absolutePath)) {
    return {
      type: "error",
      error: {
        category: "local_path_not_repository",
        message:
          "Целевая папка локального проекта уже существует. Автоматическая перезапись остановлена.",
      },
    };
  }

  try {
    await ensureDirectory(dirname(absolutePath));
    await git.cloneRepository(repositoryUrl, absolutePath);
    const newCommit = await git.readHead(absolutePath);

    return {
      type: "success",
      result: "cloned",
      localPath,
      previousCommit: null,
      newCommit,
      newCommitsCount: null,
      hasNewChanges: false,
      projectStatus: "first_loaded",
    };
  } catch (error) {
    return {
      type: "error",
      error: normalizeGitError(error, "git_command_failed"),
    };
  }
}

async function updateExistingProject({
  storage,
  git,
  project,
}: {
  storage: AppStorage;
  git: GitProjectClient;
  project: Project;
}): Promise<ProjectGitUpdateOutcome> {
  const localPath = project.localPath;

  if (localPath === null) {
    return {
      type: "error",
      error: {
        category: "local_path_missing",
        message: "Локальный путь проекта не сохранен.",
      },
    };
  }

  let absolutePath: string;

  try {
    absolutePath = resolveDataPath(storage, localPath);
  } catch (error) {
    return {
      type: "error",
      error: {
        category: "local_path_missing",
        message:
          error instanceof Error
            ? error.message
            : "Локальный путь проекта некорректен.",
      },
    };
  }

  if (!(await pathExists(absolutePath))) {
    return {
      type: "error",
      error: {
        category: "local_path_missing",
        message: "Сохраненная локальная папка проекта отсутствует.",
      },
    };
  }

  try {
    if (!(await git.isRepository(absolutePath))) {
      return {
        type: "error",
        error: {
          category: "local_path_not_repository",
          message: "Сохраненная локальная папка не является Git-репозиторием.",
        },
      };
    }

    const status = await git.readStatus(absolutePath);

    if (status.trim().length > 0) {
      return {
        type: "error",
        error: {
          category: "local_repository_dirty",
          message:
            "Локальная копия содержит изменения. Автоматическое обновление остановлено.",
        },
      };
    }

    await git.fetchMain(absolutePath);
    const originMain = await git.readOriginMain(absolutePath);
    const previousCommit = project.lastKnownCommit;
    const newCommitsCount =
      previousCommit === null
        ? null
        : await countCommitsSafely(git, absolutePath, previousCommit);
    await git.resetToOriginMain(absolutePath);
    const newCommit = await git.readHead(absolutePath);

    if (previousCommit === null) {
      return {
        type: "success",
        result: "cloned",
        localPath,
        previousCommit,
        newCommit,
        newCommitsCount: null,
        hasNewChanges: false,
        projectStatus: "first_loaded",
      };
    }

    const hasNewChanges = newCommit !== previousCommit && newCommitsCount !== 0;

    return {
      type: "success",
      result: hasNewChanges ? "updated_with_changes" : "updated_no_changes",
      localPath,
      previousCommit,
      newCommit: newCommit || originMain,
      newCommitsCount: hasNewChanges ? newCommitsCount : 0,
      hasNewChanges,
      projectStatus: hasNewChanges ? "has_changes" : "no_changes",
    };
  } catch (error) {
    return {
      type: "error",
      error: normalizeGitError(error, "git_command_failed"),
    };
  }
}

async function countCommitsSafely(
  git: GitProjectClient,
  repositoryPath: string,
  previousCommit: string,
): Promise<number> {
  try {
    return await git.countCommits(repositoryPath, previousCommit);
  } catch (error) {
    throw normalizeGitError(error, "history_rewritten");
  }
}

function finishRun(
  run: UpdateRun,
  events: UpdateEvent[],
  studentsTotal: number,
): void {
  const summary = summarizeUpdateEvents(events, studentsTotal);
  run.summary = summary;
  run.status = getRunStatusFromSummary(summary);
  run.finishedAt = createUtcTimestamp();
}

function findStudent(data: AppData, studentId: string): Student | null {
  return (
    data.studentsFile.students.find((student) => student.id === studentId) ??
    null
  );
}

function findProject(data: AppData, projectId: string): Project | null {
  return (
    data.projectsFile.projects.find((project) => project.id === projectId) ??
    null
  );
}

function findReviewStatus(data: AppData, eventId: string): ReviewStatus | null {
  return (
    data.reviewStatusesFile.reviewStatuses.find(
      (status) => status.updateEventId === eventId,
    ) ?? null
  );
}

function toStudentDetailsData(
  data: AppData,
  student: Student,
  project: Project,
): StudentDetailsData {
  const events = data.updateEventsFile.updateEvents
    .filter(
      (event) =>
        event.studentId === student.id && event.projectId === project.id,
    )
    .sort((left, right) =>
      (right.occurredAt ?? right.startedAt).localeCompare(
        left.occurredAt ?? left.startedAt,
      ),
    )
    .map((event) => toUpdateEventListItem(data, event));

  return {
    student: {
      id: student.id,
      displayName: student.displayName,
      notes: student.notes,
    },
    project: {
      id: project.id,
      repositoryUrl: project.repositoryUrl,
      localPath: project.localPath,
      defaultBranch: project.defaultBranch,
      currentBranch: project.currentBranch,
      lastKnownCommit: project.lastKnownCommit,
      lastUpdatedAt: project.lastUpdatedAt,
      lastError: project.lastError,
      status: project.status,
      statusLabel: projectStatusLabels[project.status],
      aiDescriptionStatus: project.aiDescription.status,
      aiDescriptionSummary: project.aiDescription.summary,
    },
    events,
  };
}

export function toUpdateEventListItem(
  data: AppData,
  event: UpdateEvent,
): UpdateEventListItem {
  const reviewStatus = findReviewStatus(data, event.id);
  const statusValue = reviewStatus?.status ?? "not_reviewed";
  const comments = findEventComments(data, event.id).map(
    toReviewCommentListItem,
  );
  const aiReports = findEventAiReports(data, event.id).map(toAiReportListItem);

  return {
    id: event.id,
    result: event.result,
    resultLabel:
      event.result === null
        ? "обновление выполняется"
        : updateEventResultLabels[event.result],
    status: event.status,
    reviewStatus: statusValue,
    reviewStatusLabel: reviewStatusLabels[statusValue],
    commentsCount: comments.length,
    comments,
    aiReportsCount: aiReports.length,
    aiReports,
    aiAnalysisDisabledReason: getAiAnalysisDisabledReason(data, event),
    startedAt: event.startedAt,
    finishedAt: event.finishedAt,
    occurredAt: event.occurredAt,
    repositoryUrlSnapshot: event.repositoryUrlSnapshot,
    projectLocalPathSnapshot: event.projectLocalPathSnapshot,
    branch: event.branch,
    previousCommit: event.previousCommit,
    newCommit: event.newCommit,
    newCommitsCount: event.newCommitsCount,
    hasNewChanges: event.hasNewChanges,
    error: event.error,
  };
}

function findEventAiReports(data: AppData, eventId: string): AiReport[] {
  return data.aiReportsFile.aiReports
    .filter((report) => report.updateEventId === eventId)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function findEventComments(data: AppData, eventId: string): Comment[] {
  return data.commentsFile.comments
    .filter((comment) => comment.updateEventId === eventId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function toReviewCommentListItem(comment: Comment): ReviewCommentListItem {
  return {
    id: comment.id,
    text: comment.text,
    basedOnAiReportId: comment.basedOnAiReportId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

function toAiReportListItem(report: AiReport): AiReportListItem {
  return {
    id: report.id,
    status: report.status,
    analysisMode: report.analysisMode,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    previousCommit: report.previousCommit,
    newCommit: report.newCommit,
    summary: report.summary,
    importantFiles: report.importantFiles,
    changes: report.changes,
    risks: report.risks,
    manualReviewQuestions: report.manualReviewQuestions,
    teacherCommentDraft: report.teacherCommentDraft,
    fullText: report.fullText,
    pullRequestContext: report.pullRequestContext,
    technicalDetails: report.technicalDetails,
    error: report.error,
  };
}

function getAiAnalysisDisabledReason(
  data: AppData,
  event: UpdateEvent,
): string | null {
  if (event.newCommit === null) {
    return "Нет известного нового коммита для ИИ-анализа.";
  }

  if (event.projectLocalPathSnapshot === null) {
    return "Нет локального пути проекта для ИИ-анализа.";
  }

  if (event.result === "updated_no_changes" || !event.hasNewChanges) {
    if (event.result !== "cloned") {
      return "В этом обновлении нет новой работы студента для ИИ-анализа.";
    }
  }

  if (
    event.result !== "cloned" &&
    event.result !== "updated_with_changes"
  ) {
    return "ИИ-анализ доступен только для первой загрузки или обновления с новыми коммитами.";
  }

  const codex = data.settingsFile.settings.tools.codex;

  if (codex.status === "error") {
    return (
      codex.message ??
      "Codex CLI недоступен по последней диагностике окружения."
    );
  }

  return null;
}

export function toUpdateRunListItem(run: UpdateRun): UpdateRunListItem {
  return {
    id: run.id,
    scope: run.scope,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    summary: run.summary,
    error: run.error,
  };
}

function createGitClient(data: AppData): GitProjectClient {
  return new GitCliClient(data.settingsFile.settings.tools.git.command);
}

function getProjectRelativePath(project: Project): string {
  return `repositories/${project.studentId}/${project.id}`;
}

function resolveDataPath(storage: AppStorage, relativePath: string): string {
  if (isAbsolute(relativePath)) {
    throw new Error(
      "Локальный путь проекта должен быть относительным к папке data.",
    );
  }

  const absolutePath = resolve(storage.dataRootPath, relativePath);
  const relativeToRoot = relative(storage.dataRootPath, absolutePath);

  if (
    relativeToRoot.startsWith("..") ||
    isAbsolute(relativeToRoot) ||
    relativeToRoot === ""
  ) {
    throw new Error("Локальный путь проекта выходит за пределы папки data.");
  }

  return absolutePath;
}

function normalizeGitError(
  error: unknown,
  fallbackCategory: GitUpdateErrorCategory,
): GitUpdateError {
  if (isGitUpdateError(error)) {
    return error;
  }

  if (!(error instanceof GitCommandError)) {
    return {
      category: fallbackCategory,
      message: "Git-операция завершилась ошибкой.",
      technicalDetails: error instanceof Error ? error.message : String(error),
    };
  }

  const output =
    `${error.stderr}\n${error.stdout}\n${error.message}`.toLowerCase();
  const category = classifyGitError(output, error.exitCode, fallbackCategory);
  const message = getGitErrorMessage(category);

  return {
    category,
    message,
    technicalDetails: cleanTechnicalDetails(
      `${error.stderr}\n${error.stdout}\n${error.message}`,
    ),
    command: [error.command, ...error.args].join(" "),
    exitCode: error.exitCode,
  };
}

function isGitUpdateError(value: unknown): value is GitUpdateError {
  return (
    typeof value === "object" &&
    value !== null &&
    "category" in value &&
    "message" in value &&
    typeof (value as { category: unknown }).category === "string" &&
    typeof (value as { message: unknown }).message === "string"
  );
}

function classifyGitError(
  output: string,
  exitCode: number | null,
  fallbackCategory: GitUpdateErrorCategory,
): GitUpdateErrorCategory {
  if (exitCode === null && output.includes("enoent")) {
    return "git_not_available";
  }

  if (fallbackCategory === "history_rewritten") {
    return "history_rewritten";
  }

  if (
    output.includes("remote branch main not found") ||
    output.includes("origin/main")
  ) {
    return "main_branch_missing";
  }

  if (output.includes("repository not found")) {
    return "repo_not_found";
  }

  if (
    output.includes("permission denied") ||
    output.includes("authentication failed") ||
    output.includes("could not read username") ||
    output.includes("access denied")
  ) {
    return "repo_access_denied";
  }

  if (
    output.includes("could not resolve host") ||
    output.includes("failed to connect") ||
    output.includes("network is unreachable") ||
    output.includes("connection timed out")
  ) {
    return "network_error";
  }

  return fallbackCategory;
}

function getGitErrorMessage(category: GitUpdateErrorCategory): string {
  switch (category) {
    case "repo_url_invalid":
      return "Ссылка GitHub не похожа на допустимый репозиторий.";
    case "repo_access_denied":
      return "Репозиторий недоступен: проверьте доступ GitHub или локальную аутентификацию.";
    case "repo_not_found":
      return "Репозиторий не найден. Проверьте ссылку GitHub.";
    case "network_error":
      return "Git не смог подключиться к GitHub. Проверьте интернет-соединение.";
    case "git_not_available":
      return "Команда Git недоступна. Проверьте установку Git или путь в настройках.";
    case "main_branch_missing":
      return "В репозитории не найдена ветка main.";
    case "local_path_missing":
      return "Сохраненная локальная папка проекта отсутствует.";
    case "local_path_not_repository":
      return "Сохраненная локальная папка не является ожидаемым Git-репозиторием.";
    case "local_repository_dirty":
      return "Локальная копия содержит изменения. Автоматическое обновление остановлено.";
    case "local_repository_corrupted":
      return "Локальная копия повреждена или недоступна для Git.";
    case "history_rewritten":
      return "Предыдущий известный коммит не найден в истории main. Проект требует ручного решения.";
    case "git_command_failed":
      return "Git-команда завершилась ошибкой.";
  }
}

function cleanTechnicalDetails(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 1000);
}

function toAppError(error: unknown): AppError {
  if (error instanceof StorageError) {
    return error.appError;
  }

  return normalizeUnknownError(error);
}
