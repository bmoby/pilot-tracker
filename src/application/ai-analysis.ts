import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import type {
  AiPullRequestContext,
  AiReport,
  AppData,
  Project,
  Student,
  UpdateEvent,
} from "@/domain/schemas";
import { createPrefixedId } from "@/domain/ids";
import { createUtcTimestamp } from "@/domain/student-rules";
import type { CodexAnalysisClient } from "@/integrations/codex";
import { CodexCliClient, CodexCommandError } from "@/integrations/codex";
import {
  GitCliClient,
  GitCommandError,
  type GitAnalysisClient,
  type GitReviewCopyClient,
} from "@/integrations/git";
import {
  GitHubCliClient,
  type PullRequestContextClient,
} from "@/integrations/github";
import {
  failure,
  normalizeUnknownError,
  success,
  type AppError,
  type AppResult,
} from "@/shared/result";
import { AppStorage, getDefaultStorage } from "@/storage/app-storage";
import { StorageError } from "@/storage/storage-error";
import { prepareReviewCopy } from "./review-code";

const AI_REPORT_OUTPUT_SCHEMA_PATH = resolve(
  process.cwd(),
  "src/application/ai-report-output-schema.json",
);
const GIT_CONTEXT_LIMIT = 40_000;
const TECHNICAL_DETAILS_LIMIT = 1_200;

export type RunAiAnalysisInput = {
  updateEventId: string;
  aiAnalysisJobId?: string;
};

export type RunAiAnalysisResponse = {
  studentId: string;
  projectId: string;
  updateEventId: string;
  aiReportId: string;
  status: AiReport["status"];
};

export type AiAnalysisGitClient = GitReviewCopyClient & GitAnalysisClient;

export async function runAiAnalysisForUpdate(
  input: RunAiAnalysisInput,
  storage = getDefaultStorage(),
  gitClient?: AiAnalysisGitClient,
  codexClient?: CodexAnalysisClient,
  pullRequestClient?: PullRequestContextClient,
): Promise<AppResult<RunAiAnalysisResponse>> {
  try {
    const data = await storage.load();
    const event = findUpdateEvent(data, input.updateEventId);

    if (event === null) {
      return failure({
        code: "update_event_not_found",
        message: "Событие обновления не найдено.",
      });
    }

    const student = findStudent(data, event.studentId);
    const project = findProject(data, event.projectId);

    if (student === null || project === null) {
      return failure({
        code: "ai_analysis_data_invalid",
        message:
          "Событие обновления ссылается на отсутствующего студента или проект.",
      });
    }

    const blocked = getBlockedReason(data, event);

    if (blocked !== null) {
      return failure(blocked);
    }

    const git =
      gitClient ??
      new GitCliClient(data.settingsFile.settings.tools.git.command);
    const codex =
      codexClient ??
      new CodexCliClient(data.settingsFile.settings.tools.codex.command);
    const pullRequests =
      pullRequestClient ??
      new GitHubCliClient(data.settingsFile.settings.tools.gh.command);
    const report = createRunningReport(data, event);

    await saveReportSnapshot(storage, report, input.aiAnalysisJobId);

    const prepared = await prepareReviewCopy({ storage, git, event, project });

    if (!prepared.ok) {
      finishReportWithError(
        report,
        prepared.error.message,
        prepared.error.details ?? null,
      );
      await saveReportSnapshot(storage, report, input.aiAnalysisJobId);
      return success(toResponse(report));
    }

    report.analysisPath = toDataRelativePath(
      storage,
      prepared.value.reviewCopyPath,
    );
    report.pullRequestContext = await resolvePullRequestContext({
      data,
      event,
      project,
      pullRequests,
    });

    const context = await collectGitContext({
      git,
      report,
      reviewCopyPath: prepared.value.reviewCopyPath,
    });

    if (!context.ok) {
      finishReportWithError(
        report,
        context.error.message,
        context.error.details ?? null,
      );
      await saveReportSnapshot(storage, report, input.aiAnalysisJobId);
      return success(toResponse(report));
    }

    const runDirectory = resolve(storage.logsPath, "ai-runs", report.id);
    await mkdir(runDirectory, { recursive: true });
    const outputPath = resolve(runDirectory, "last-message.json");
    const prompt = buildPrompt({
      student,
      project,
      event,
      report,
      context: context.value,
      data,
    });

    try {
      await codex.runAnalysis({
        workingDirectory: prepared.value.reviewCopyPath,
        schemaPath: AI_REPORT_OUTPUT_SCHEMA_PATH,
        outputPath,
        prompt,
      });
    } catch (error) {
      const appError = normalizeCodexError(error);
      finishReportWithError(report, appError.message, appError.details ?? null);
      await saveReportSnapshot(storage, report, input.aiAnalysisJobId);
      return success(toResponse(report));
    }

    const parsed = await readCodexOutput(outputPath);

    if (!parsed.ok) {
      finishReportWithError(
        report,
        parsed.error.message,
        parsed.error.details ?? null,
      );
      await saveReportSnapshot(storage, report, input.aiAnalysisJobId);
      return success(toResponse(report));
    }

    finishReportWithResult(report, parsed.value, context.value);
    updateProjectDescription(project, report, parsed.value);
    await saveReportSnapshot(storage, report, input.aiAnalysisJobId, project);

    return success(toResponse(report));
  } catch (error) {
    return failure(toAppError(error));
  }
}

export function getAiAnalysisBlockedReason(
  data: AppData,
  event: UpdateEvent,
): AppError | null {
  if (event.newCommit === null) {
    return {
      code: "ai_analysis_commit_missing",
      message:
        "ИИ-анализ недоступен: у обновления нет известного нового коммита.",
    };
  }

  if (event.projectLocalPathSnapshot === null) {
    return {
      code: "ai_analysis_local_path_missing",
      message:
        "ИИ-анализ недоступен: для обновления не сохранен локальный путь проекта.",
    };
  }

  if (!canAnalyzeUpdateEvent(event)) {
    return {
      code: "ai_analysis_no_new_student_work",
      message:
        "ИИ-анализ недоступен: в этом обновлении нет новой работы студента.",
    };
  }

  const codex = data.settingsFile.settings.tools.codex;

  if (codex.status === "error") {
    return {
      code: "codex_unavailable",
      message:
        codex.message ??
        "ИИ-анализ недоступен: Codex CLI отмечен ошибкой в диагностике окружения.",
    };
  }

  return null;
}

const getBlockedReason = getAiAnalysisBlockedReason;

function canAnalyzeUpdateEvent(event: UpdateEvent): boolean {
  if (event.result === "cloned" && event.previousCommit === null) {
    return true;
  }

  return (
    event.result === "updated_with_changes" &&
    event.previousCommit !== null &&
    event.newCommit !== null &&
    event.previousCommit !== event.newCommit &&
    event.newCommitsCount !== null &&
    event.newCommitsCount > 0
  );
}

function createRunningReport(data: AppData, event: UpdateEvent): AiReport {
  const now = createUtcTimestamp();
  const mode: AiReport["analysisMode"] =
    event.previousCommit === null ? "current_state" : "changes_between_commits";

  return {
    id: createPrefixedId("ai_report"),
    studentId: event.studentId,
    projectId: event.projectId,
    updateEventId: event.id,
    status: "running",
    analysisMode: mode,
    startedAt: now,
    finishedAt: null,
    repositoryUrlSnapshot: event.repositoryUrlSnapshot,
    projectLocalPathSnapshot: event.projectLocalPathSnapshot,
    analysisPath: null,
    branch: event.branch,
    previousCommit: event.previousCommit,
    newCommit: event.newCommit,
    summary: null,
    importantFiles: [],
    changes: null,
    risks: [],
    manualReviewQuestions: [],
    teacherCommentDraft: null,
    fullText: null,
    pullRequestContext: createPullRequestContext("not_requested", null),
    technicalDetails: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function resolvePullRequestContext({
  data,
  event,
  project,
  pullRequests,
}: {
  data: AppData;
  event: UpdateEvent;
  project: Project;
  pullRequests: PullRequestContextClient;
}): Promise<AiPullRequestContext> {
  const repositoryUrl = event.repositoryUrlSnapshot ?? project.repositoryUrl;

  if (repositoryUrl === null || event.newCommit === null) {
    return createPullRequestContext(
      "not_requested",
      "GitHub-ссылка или новый коммит отсутствуют.",
    );
  }

  const gh = data.settingsFile.settings.tools.gh;

  if (gh.status === "error") {
    return createPullRequestContext(
      "unavailable",
      gh.message ?? "GitHub CLI недоступен по последней диагностике окружения.",
    );
  }

  try {
    return await pullRequests.findPullRequestContext({
      repositoryUrl,
      newCommit: event.newCommit,
    });
  } catch (error) {
    return createPullRequestContext(
      "unavailable",
      error instanceof Error
        ? cleanDetails(error.message)
        : cleanDetails(String(error)),
    );
  }
}

async function collectGitContext({
  git,
  report,
  reviewCopyPath,
}: {
  git: AiAnalysisGitClient;
  report: AiReport;
  reviewCopyPath: string;
}): Promise<AppResult<GitContext>> {
  try {
    const files = limitContext(await git.listTrackedFiles(reviewCopyPath));
    const log = limitContext(
      await git.readCommitLog(
        reviewCopyPath,
        report.previousCommit,
        requireNewCommit(report),
      ),
    );
    const diff =
      report.analysisMode === "changes_between_commits" &&
      report.previousCommit !== null
        ? limitContext(
            await git.readDiff(
              reviewCopyPath,
              report.previousCommit,
              requireNewCommit(report),
            ),
          )
        : { text: "", truncated: false };

    return success({
      files: files.text,
      filesTruncated: files.truncated,
      log: log.text,
      logTruncated: log.truncated,
      diff: diff.text,
      diffTruncated: diff.truncated,
    });
  } catch (error) {
    return failure(normalizeGitError(error));
  }
}

function requireNewCommit(report: AiReport): string {
  if (report.newCommit === null) {
    throw new Error("У ИИ-рапорта нет нового коммита.");
  }

  return report.newCommit;
}

type GitContext = {
  files: string;
  filesTruncated: boolean;
  log: string;
  logTruncated: boolean;
  diff: string;
  diffTruncated: boolean;
};

const codexOutputSchema = z.object({
  summary: z.string().trim().min(1).catch("ИИ не вернул краткое резюме."),
  importantFiles: z.array(z.string()).catch([]),
  changes: z
    .string()
    .trim()
    .min(1)
    .catch("ИИ не вернул описание добавленной функциональности."),
  risks: z.array(z.string()).catch([]),
  manualReviewQuestions: z.array(z.string()).catch([]),
  teacherCommentDraft: z.string().trim().min(1).catch(""),
  fullText: z.string().trim().min(1).catch(""),
  projectDescription: z
    .object({
      summary: z.string().trim().min(1).catch(""),
      idea: z.string().trim().min(1).catch(""),
      keyParts: z.array(z.string()).catch([]),
    })
    .nullable()
    .catch(null),
});

type CodexOutput = z.infer<typeof codexOutputSchema>;

async function readCodexOutput(
  outputPath: string,
): Promise<AppResult<CodexOutput>> {
  let raw: string;

  try {
    raw = await readFile(outputPath, "utf8");
  } catch (error) {
    return failure({
      code: "ai_output_missing",
      message: "Codex CLI не сохранил финальный ИИ-рапорт.",
      details: error instanceof Error ? error.message : String(error),
      path: outputPath,
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return failure({
      code: "ai_output_parse_error",
      message: "Финальный ответ Codex CLI не является корректным JSON.",
      details: error instanceof Error ? error.message : String(error),
      path: outputPath,
    });
  }

  const result = codexOutputSchema.safeParse(parsed);

  if (!result.success) {
    return failure({
      code: "ai_output_schema_error",
      message: "Финальный ответ Codex CLI не соответствует схеме ИИ-рапорта.",
      details: result.error.message,
      path: outputPath,
    });
  }

  return success(result.data);
}

function finishReportWithResult(
  report: AiReport,
  output: CodexOutput,
  context: GitContext,
): void {
  const now = createUtcTimestamp();
  report.status = "ready";
  report.finishedAt = now;
  report.summary = output.summary;
  report.importantFiles = output.importantFiles;
  report.changes = output.changes;
  report.risks = output.risks;
  report.manualReviewQuestions = output.manualReviewQuestions;
  report.teacherCommentDraft = output.teacherCommentDraft || null;
  report.fullText = output.fullText || buildFullText(output);
  report.technicalDetails = buildTechnicalDetails(context);
  report.error = null;
  report.updatedAt = now;
}

function finishReportWithError(
  report: AiReport,
  message: string,
  technicalDetails: string | null,
): void {
  const now = createUtcTimestamp();
  report.status = "error";
  report.finishedAt = now;
  report.summary = null;
  report.fullText = null;
  report.technicalDetails =
    technicalDetails === null ? null : cleanDetails(technicalDetails);
  report.error = message;
  report.updatedAt = now;
}

function updateProjectDescription(
  project: Project,
  report: AiReport,
  output: CodexOutput,
): void {
  if (
    report.analysisMode !== "current_state" ||
    output.projectDescription === null
  ) {
    return;
  }

  if (output.projectDescription.summary.length === 0) {
    return;
  }

  const now = createUtcTimestamp();
  project.aiDescription = {
    status: "ready",
    summary: output.projectDescription.summary,
    idea: output.projectDescription.idea || null,
    keyParts: output.projectDescription.keyParts,
    sourceAiReportId: report.id,
    sourceCommit: report.newCommit,
    updatedAt: now,
    error: null,
  };
  project.updatedAt = now;
}

async function saveReportSnapshot(
  storage: AppStorage,
  report: AiReport,
  aiAnalysisJobId?: string,
  project?: Project,
): Promise<void> {
  const keys: Array<keyof AppData> = ["aiReportsFile"];

  if (aiAnalysisJobId !== undefined) {
    keys.push("aiAnalysisJobsFile");
  }

  if (project !== undefined) {
    keys.push("projectsFile");
  }

  await storage.updateFiles(keys, (data) => {
    const reportIndex = data.aiReportsFile.aiReports.findIndex(
      (item) => item.id === report.id,
    );

    if (reportIndex === -1) {
      data.aiReportsFile.aiReports.push({ ...report });
    } else {
      data.aiReportsFile.aiReports[reportIndex] = { ...report };
    }

    if (aiAnalysisJobId !== undefined) {
      const job = data.aiAnalysisJobsFile.aiAnalysisJobs.find(
        (item) => item.id === aiAnalysisJobId,
      );

      if (job !== undefined) {
        job.aiReportId = report.id;
        job.updatedAt = report.updatedAt;
      }
    }

    if (project !== undefined) {
      const projectToUpdate = data.projectsFile.projects.find(
        (item) => item.id === project.id,
      );

      if (projectToUpdate !== undefined) {
        projectToUpdate.aiDescription = project.aiDescription;
        projectToUpdate.updatedAt = project.updatedAt;
      }
    }
  });
}

function buildPrompt({
  student,
  project,
  event,
  report,
  context,
  data,
}: {
  student: Student;
  project: Project;
  event: UpdateEvent;
  report: AiReport;
  context: GitContext;
  data: AppData;
}): string {
  const previousComments = data.commentsFile.comments.filter(
    (comment) => comment.updateEventId === event.id,
  );
  const previousReports = data.aiReportsFile.aiReports.filter(
    (item) => item.updateEventId === event.id && item.id !== report.id,
  );

  return [
    "Ты помогаешь преподавателю проверить учебный проект студента.",
    "Нельзя изменять файлы, создавать коммиты, делать push, публиковать комментарии в GitHub или выставлять итоговый статус проверки.",
    "Выводы ИИ являются подсказкой и должны быть проверены преподавателем.",
    "Пиши простым человеческим языком для преподавателя. Не превращай рапорт в технический пересказ diff, файлов, библиотек или внутренней структуры проекта.",
    "Главная задача рапорта: быстро объяснить, что студент добавил как функциональность или видимое поведение, что можно быстро проверить руками, какие вопросы задать студенту и какой комментарий можно оставить.",
    "Не добавляй отдельные разделы про влияние обновления на проект или направление движения студента.",
    "Технические детали используй только как источник проверки. Файлы можно перечислить в importantFiles, но основной текст должен быть про смысл работы.",
    "",
    "Верни только JSON, соответствующий переданной схеме результата.",
    "Поля результата заполняй так:",
    "- summary: 2-4 предложения простым языком.",
    "- changes: что добавлено как функциональность или видимое поведение проекта. Не перечисляй файлы без объяснения смысла.",
    "- risks: короткий список того, что преподавателю стоит быстро проверить руками.",
    "- manualReviewQuestions: вопросы, которые стоит задать студенту.",
    "- teacherCommentDraft: черновик комментария преподавателя, не финальная оценка.",
    "- importantFiles: техническая справка для углубления, если преподаватель решит открыть код.",
    "",
    "Данные студента и проекта:",
    JSON.stringify(
      {
        student: {
          displayName: student.displayName,
          notes: student.notes,
        },
        project: {
          repositoryUrl: event.repositoryUrlSnapshot ?? project.repositoryUrl,
          branch: event.branch,
          aiDescription: project.aiDescription,
        },
        update: {
          id: event.id,
          result: event.result,
          analysisMode: report.analysisMode,
          previousCommit: event.previousCommit,
          newCommit: event.newCommit,
          newCommitsCount: event.newCommitsCount,
          occurredAt: event.occurredAt,
        },
        pullRequestContext: report.pullRequestContext,
        previousComments,
        previousAiReports: previousReports.map((item) => ({
          status: item.status,
          summary: item.summary,
          quickChecks: item.risks,
          createdAt: item.createdAt,
        })),
      },
      null,
      2,
    ),
    "",
    "Git log:",
    context.log || "Нет данных.",
    "",
    report.analysisMode === "changes_between_commits"
      ? "Git diff:"
      : "Список файлов проекта:",
    report.analysisMode === "changes_between_commits"
      ? context.diff || "Нет данных diff."
      : context.files || "Нет списка файлов.",
    "",
    report.analysisMode === "changes_between_commits"
      ? "Сформируй стандартный ИИ-рапорт по новой работе студента: краткое резюме, что добавлено как функциональность, что быстро проверить руками, вопросы студенту и черновик комментария преподавателя."
      : "Сформируй стандартный ИИ-рапорт по первой загрузке проекта: краткое резюме, что уже можно увидеть или попробовать, что быстро проверить руками, вопросы студенту и черновик комментария преподавателя.",
    "Если анализируется текущее состояние проекта, заполни projectDescription. Если анализируется диапазон изменений и описание проекта менять не нужно, верни projectDescription: null.",
  ].join("\n");
}

function buildFullText(output: CodexOutput): string {
  return [
    output.summary,
    output.changes,
    output.risks.length > 0
      ? `Что быстро проверить: ${output.risks.join("; ")}`
      : null,
    output.manualReviewQuestions.length > 0
      ? `Вопросы студенту: ${output.manualReviewQuestions.join("; ")}`
      : null,
    output.teacherCommentDraft
      ? `Черновик: ${output.teacherCommentDraft}`
      : null,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join("\n\n");
}

function buildTechnicalDetails(context: GitContext): string | null {
  const truncated = [
    context.filesTruncated ? "список файлов" : null,
    context.logTruncated ? "git log" : null,
    context.diffTruncated ? "git diff" : null,
  ].filter((item): item is string => item !== null);

  if (truncated.length === 0) {
    return null;
  }

  return `Переданные данные были усечены: ${truncated.join(", ")}.`;
}

function createPullRequestContext(
  status: AiPullRequestContext["status"],
  error: string | null,
): AiPullRequestContext {
  return {
    status,
    number: null,
    title: null,
    url: null,
    state: null,
    error,
  };
}

function limitContext(value: string): { text: string; truncated: boolean } {
  if (value.length <= GIT_CONTEXT_LIMIT) {
    return { text: value, truncated: false };
  }

  return {
    text: value.slice(0, GIT_CONTEXT_LIMIT),
    truncated: true,
  };
}

function toDataRelativePath(storage: AppStorage, path: string): string {
  const relativeToRoot = relative(storage.dataRootPath, path);

  if (
    relativeToRoot.length > 0 &&
    !relativeToRoot.startsWith("..") &&
    !isAbsolute(relativeToRoot)
  ) {
    return relativeToRoot;
  }

  return path;
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

function findUpdateEvent(
  data: AppData,
  updateEventId: string,
): UpdateEvent | null {
  return (
    data.updateEventsFile.updateEvents.find(
      (event) => event.id === updateEventId,
    ) ?? null
  );
}

function normalizeGitError(error: unknown): AppError {
  if (!(error instanceof GitCommandError)) {
    return {
      code: "ai_git_context_failed",
      message: "Git не смог подготовить контекст для ИИ-анализа.",
      details: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    code: "ai_git_context_failed",
    message: "Git не смог подготовить контекст для ИИ-анализа.",
    details: cleanDetails(`${error.stderr}\n${error.stdout}\n${error.message}`),
  };
}

function normalizeCodexError(error: unknown): AppError {
  if (!(error instanceof CodexCommandError)) {
    return {
      code: "codex_run_failed",
      message: "Codex CLI не смог выполнить ИИ-анализ.",
      details: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    code: error.exitCode === null ? "codex_not_available" : "codex_run_failed",
    message:
      error.exitCode === null
        ? "Codex CLI недоступен во время запуска ИИ-анализа."
        : "Codex CLI завершил ИИ-анализ с ошибкой.",
    details: cleanDetails(`${error.stderr}\n${error.stdout}\n${error.message}`),
  };
}

function toResponse(report: AiReport): RunAiAnalysisResponse {
  return {
    studentId: report.studentId,
    projectId: report.projectId,
    updateEventId: report.updateEventId,
    aiReportId: report.id,
    status: report.status,
  };
}

function cleanDetails(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, TECHNICAL_DETAILS_LIMIT);
}

function toAppError(error: unknown): AppError {
  if (error instanceof StorageError) {
    return error.appError;
  }

  return normalizeUnknownError(error);
}
