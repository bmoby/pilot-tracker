import { appendFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { AppData, Project, Student, UpdateEvent } from "@/domain/schemas";
import { createUtcTimestamp } from "@/domain/student-rules";
import { GitCliClient, GitCommandError, type GitReviewCopyClient } from "@/integrations/git";
import { type CodeOpenClient, VsCodeCliClient, VsCodeCommandError } from "@/integrations/vscode";
import { failure, normalizeUnknownError, success, type AppError, type AppResult } from "@/shared/result";
import { AppStorage, getDefaultStorage } from "@/storage/app-storage";
import { ensureDirectory, pathExists } from "@/storage/file-system";
import { StorageError } from "@/storage/storage-error";

export type OpenUpdateCodeInput = {
  updateEventId: string;
};

export type OpenUpdateCodeResponse = {
  studentId: string;
  projectId: string;
  updateEventId: string;
  reviewCopyPath: string;
};

type ReviewCopyPreparation = {
  reviewCopyPath: string;
};

export async function openUpdateCodeInVsCode(
  input: OpenUpdateCodeInput,
  storage = getDefaultStorage(),
  gitClient?: GitReviewCopyClient,
  codeClient?: CodeOpenClient,
): Promise<AppResult<OpenUpdateCodeResponse>> {
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
      const error = {
        code: "review_data_invalid",
        message: "Событие обновления ссылается на отсутствующего студента или проект.",
      };
      await writeReviewCodeDiagnostic(storage, error, event, null);
      return failure(error);
    }

    const git = gitClient ?? new GitCliClient(data.settingsFile.settings.tools.git.command);
    const code = codeClient ?? new VsCodeCliClient(data.settingsFile.settings.tools.code.command);
    const prepared = await prepareReviewCopy({ storage, git, event, project });

    if (!prepared.ok) {
      await writeReviewCodeDiagnostic(storage, prepared.error, event, null);
      return failure(prepared.error);
    }

    try {
      await code.openPath(prepared.value.reviewCopyPath);
    } catch (error) {
      const appError = normalizeVsCodeError(error, prepared.value.reviewCopyPath);
      await writeReviewCodeDiagnostic(storage, appError, event, prepared.value.reviewCopyPath);
      return failure(appError);
    }

    return success({
      studentId: student.id,
      projectId: project.id,
      updateEventId: event.id,
      reviewCopyPath: prepared.value.reviewCopyPath,
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

async function prepareReviewCopy({
  storage,
  git,
  event,
  project,
}: {
  storage: AppStorage;
  git: GitReviewCopyClient;
  event: UpdateEvent;
  project: Project;
}): Promise<AppResult<ReviewCopyPreparation>> {
  const targetCommit = event.newCommit;

  if (targetCommit === null) {
    return failure({
      code: "update_commit_missing",
      message: "У обновления нет известного коммита, который можно открыть.",
    });
  }

  const mainRepositoryPath = resolveMainRepositoryPath(storage, event, project);

  if (!mainRepositoryPath.ok) {
    return failure(mainRepositoryPath.error);
  }

  if (!(await pathExists(mainRepositoryPath.value))) {
    return failure({
      code: "main_repository_missing",
      message: "Основная локальная копия проекта отсутствует. Сначала обновите проект.",
      path: mainRepositoryPath.value,
    });
  }

  try {
    if (!(await git.isRepository(mainRepositoryPath.value))) {
      return failure({
        code: "main_repository_invalid",
        message: "Основная локальная копия не является ожидаемым Git-репозиторием.",
        path: mainRepositoryPath.value,
      });
    }
  } catch (error) {
    return failure(normalizeGitReviewError(error, "git_command_failed", mainRepositoryPath.value));
  }

  try {
    const branch = await git.readCurrentBranch(mainRepositoryPath.value);

    if (branch !== "main") {
      return failure({
        code: "main_repository_invalid",
        message: "Основная локальная копия должна оставаться на ветке main.",
        path: mainRepositoryPath.value,
        details: `Текущая ветка: ${branch || "detached HEAD"}.`,
      });
    }
  } catch (error) {
    return failure(normalizeGitReviewError(error, "git_command_failed", mainRepositoryPath.value));
  }

  try {
    await git.verifyCommit(mainRepositoryPath.value, targetCommit);
  } catch (error) {
    return failure(normalizeGitReviewError(error, "commit_not_available", mainRepositoryPath.value));
  }

  const reviewCopyPath = resolveReviewCopyPath(storage, event.studentId, event.id);

  if (!reviewCopyPath.ok) {
    return failure(reviewCopyPath.error);
  }

  if (await pathExists(reviewCopyPath.value)) {
    const existing = await validateExistingReviewCopy({
      git,
      mainRepositoryPath: mainRepositoryPath.value,
      reviewCopyPath: reviewCopyPath.value,
      targetCommit,
    });

    if (!existing.ok) {
      return failure(existing.error);
    }

    if (existing.value.reviewCopyPath !== null) {
      return success({ reviewCopyPath: existing.value.reviewCopyPath });
    }
  }

  await ensureDirectory(dirname(reviewCopyPath.value));

  try {
    await git.createDetachedWorktree(mainRepositoryPath.value, reviewCopyPath.value, targetCommit);
  } catch (error) {
    return failure(normalizeGitReviewError(error, "worktree_create_failed", reviewCopyPath.value));
  }

  try {
    const head = await git.readHead(reviewCopyPath.value);

    if (head !== targetCommit) {
      return failure({
        code: "review_copy_mismatch",
        message: "Созданная review-копия указывает на другой коммит.",
        path: reviewCopyPath.value,
        details: `Ожидался коммит ${targetCommit}, получен ${head}.`,
      });
    }
  } catch (error) {
    return failure(normalizeGitReviewError(error, "git_command_failed", reviewCopyPath.value));
  }

  return success({ reviewCopyPath: reviewCopyPath.value });
}

async function validateExistingReviewCopy({
  git,
  mainRepositoryPath,
  reviewCopyPath,
  targetCommit,
}: {
  git: GitReviewCopyClient;
  mainRepositoryPath: string;
  reviewCopyPath: string;
  targetCommit: string;
}): Promise<AppResult<{ reviewCopyPath: string | null }>> {
  try {
    if (!(await git.isRepository(reviewCopyPath))) {
      return failure({
        code: "review_copy_mismatch",
        message: "Существующая review-копия не является ожидаемым Git-репозиторием.",
        path: reviewCopyPath,
      });
    }
  } catch (error) {
    return failure(normalizeGitReviewError(error, "git_command_failed", reviewCopyPath));
  }

  let head: string;

  try {
    const status = await git.readStatus(reviewCopyPath);

    if (status.trim().length > 0) {
      return failure({
        code: "review_copy_dirty",
        message: "Существующая review-копия содержит локальные изменения и не будет перезаписана.",
        path: reviewCopyPath,
      });
    }

    head = await git.readHead(reviewCopyPath);
  } catch (error) {
    return failure(normalizeGitReviewError(error, "git_command_failed", reviewCopyPath));
  }

  if (head === targetCommit) {
    return success({ reviewCopyPath });
  }

  try {
    await git.removeWorktree(mainRepositoryPath, reviewCopyPath);
    return success({ reviewCopyPath: null });
  } catch (error) {
    return failure(normalizeGitReviewError(error, "worktree_remove_failed", reviewCopyPath));
  }
}

function resolveMainRepositoryPath(
  storage: AppStorage,
  event: UpdateEvent,
  project: Project,
): AppResult<string> {
  const relativePath = event.projectLocalPathSnapshot ?? project.localPath;

  if (relativePath === null) {
    return failure({
      code: "main_repository_missing",
      message: "Для обновления не сохранен локальный путь проекта.",
    });
  }

  return resolveDataPath(storage, relativePath, "main_repository_invalid");
}

function resolveReviewCopyPath(
  storage: AppStorage,
  studentId: string,
  updateEventId: string,
): AppResult<string> {
  const absolutePath = resolve(storage.reviewCopiesPath, studentId, updateEventId);
  const relativeToBase = relative(storage.reviewCopiesPath, absolutePath);

  if (relativeToBase.startsWith("..") || isAbsolute(relativeToBase) || relativeToBase === "") {
    return failure({
      code: "review_path_invalid",
      message: "Путь review-копии выходит за пределы папки review-копий.",
      path: absolutePath,
    });
  }

  return success(absolutePath);
}

function resolveDataPath(
  storage: AppStorage,
  relativePath: string,
  errorCode: string,
): AppResult<string> {
  if (isAbsolute(relativePath)) {
    return failure({
      code: errorCode,
      message: "Локальный путь проекта должен быть относительным к папке data.",
      path: relativePath,
    });
  }

  const absolutePath = resolve(storage.dataRootPath, relativePath);
  const relativeToRoot = relative(storage.dataRootPath, absolutePath);

  if (relativeToRoot.startsWith("..") || isAbsolute(relativeToRoot) || relativeToRoot === "") {
    return failure({
      code: errorCode,
      message: "Локальный путь проекта выходит за пределы папки data.",
      path: absolutePath,
    });
  }

  return success(absolutePath);
}

function findStudent(data: AppData, studentId: string): Student | null {
  return data.studentsFile.students.find((student) => student.id === studentId) ?? null;
}

function findProject(data: AppData, projectId: string): Project | null {
  return data.projectsFile.projects.find((project) => project.id === projectId) ?? null;
}

function findUpdateEvent(data: AppData, updateEventId: string): UpdateEvent | null {
  return data.updateEventsFile.updateEvents.find((event) => event.id === updateEventId) ?? null;
}

function normalizeGitReviewError(error: unknown, fallbackCode: string, path: string): AppError {
  if (!(error instanceof GitCommandError)) {
    return {
      code: fallbackCode,
      message: getReviewCodeMessage(fallbackCode),
      details: error instanceof Error ? error.message : String(error),
      path,
    };
  }

  const output = `${error.stderr}\n${error.stdout}\n${error.message}`.toLowerCase();
  const code =
    error.exitCode === null && output.includes("enoent") ? "git_command_failed" : fallbackCode;

  return {
    code,
    message: getReviewCodeMessage(code),
    details: cleanTechnicalDetails(`${error.stderr}\n${error.stdout}\n${error.message}`),
    path,
  };
}

function normalizeVsCodeError(error: unknown, reviewCopyPath: string): AppError {
  if (!(error instanceof VsCodeCommandError)) {
    return {
      code: "vscode_open_failed",
      message: "VS Code не удалось открыть review-копию.",
      details: error instanceof Error ? error.message : String(error),
      path: reviewCopyPath,
    };
  }

  const code = error.exitCode === null ? "vscode_not_available" : "vscode_open_failed";

  return {
    code,
    message:
      code === "vscode_not_available"
        ? "Команда VS Code недоступна. Review-копию можно открыть вручную по указанному пути."
        : "VS Code не удалось открыть review-копию.",
    details: cleanTechnicalDetails(`${error.stderr}\n${error.stdout}\n${error.message}`),
    path: reviewCopyPath,
  };
}

function getReviewCodeMessage(code: string): string {
  switch (code) {
    case "commit_not_available":
      return "Локальная копия проекта не содержит нужный коммит.";
    case "worktree_create_failed":
      return "Git не смог создать review-копию.";
    case "worktree_remove_failed":
      return "Git не смог удалить чистую несоответствующую review-копию.";
    case "git_command_failed":
      return "Git-команда для review-копии завершилась ошибкой.";
    default:
      return "Код обновления не удалось открыть.";
  }
}

async function writeReviewCodeDiagnostic(
  storage: AppStorage,
  error: AppError,
  event: UpdateEvent,
  reviewCopyPath: string | null,
): Promise<void> {
  try {
    await ensureDirectory(storage.logsPath);
    const logPath = resolve(storage.logsPath, "diagnostics.jsonl");
    const payload = {
      occurredAt: createUtcTimestamp(),
      level: "ошибка",
      area: error.code.startsWith("vscode") ? "VS Code" : "review-копия",
      updateEventId: event.id,
      studentId: event.studentId,
      projectId: event.projectId,
      message: error.message,
      technicalDetails: cleanTechnicalDetails(error.details ?? ""),
      path: toDiagnosticPath(storage, reviewCopyPath ?? error.path ?? null),
      code: error.code,
    };

    await appendFile(logPath, `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    return;
  }
}

function toDiagnosticPath(storage: AppStorage, path: string | null): string | null {
  if (path === null) {
    return null;
  }

  const relativeToDataRoot = relative(storage.dataRootPath, path);

  if (
    relativeToDataRoot.length > 0 &&
    !relativeToDataRoot.startsWith("..") &&
    !isAbsolute(relativeToDataRoot)
  ) {
    return relativeToDataRoot;
  }

  return path;
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
