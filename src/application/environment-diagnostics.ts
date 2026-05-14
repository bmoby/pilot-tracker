import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  AppSettings,
  PathDiagnostics,
  ToolAuthStatus,
} from "@/domain/schemas";
import {
  failure,
  normalizeUnknownError,
  success,
  type AppError,
  type AppResult,
} from "@/shared/result";
import { AppStorage, getDefaultStorage } from "@/storage/app-storage";
import { StorageError } from "@/storage/storage-error";

const COMMAND_TIMEOUT_MS = 5_000;
const DETAILS_LIMIT = 1_200;

type ToolKey = keyof AppSettings["tools"];
type ToolSettings = AppSettings["tools"][ToolKey];

export type DiagnosticCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
  timedOut: boolean;
};

export type DiagnosticCommandRunner = (
  command: string,
  args: string[],
  options?: {
    timeoutMs?: number;
  },
) => Promise<DiagnosticCommandResult>;

export type EnvironmentDiagnosticsResult = {
  checkedAt: string;
};

export type EnvironmentDiagnosticsOptions = {
  storage?: AppStorage;
  runner?: DiagnosticCommandRunner;
  now?: () => Date;
};

export async function runEnvironmentDiagnostics(
  options: EnvironmentDiagnosticsOptions = {},
): Promise<AppResult<EnvironmentDiagnosticsResult>> {
  try {
    const storage = options.storage ?? getDefaultStorage();
    const runner = options.runner ?? runDiagnosticCommand;
    const checkedAt = (options.now ?? (() => new Date()))().toISOString();
    const data = await storage.load();
    const settings = data.settingsFile.settings;

    data.settingsFile.settings = {
      ...settings,
      paths: await diagnosePaths(storage, checkedAt),
      tools: await diagnoseTools(settings.tools, runner, checkedAt),
    };

    await storage.saveFiles(data, ["settingsFile"]);

    return success({ checkedAt });
  } catch (error) {
    return failure(toAppError(error));
  }
}

async function diagnosePaths(
  storage: AppStorage,
  checkedAt: string,
): Promise<NonNullable<AppSettings["paths"]>> {
  return {
    dataRoot: await diagnoseDirectory(storage.dataRootPath, checkedAt),
    appData: await diagnoseDirectory(storage.appDataPath, checkedAt),
    repositories: await diagnoseDirectory(storage.repositoriesPath, checkedAt),
    reviewCopies: await diagnoseDirectory(storage.reviewCopiesPath, checkedAt),
    backups: await diagnoseDirectory(storage.backupsPath, checkedAt),
    settingsFile: await diagnoseSettingsFile(
      resolve(storage.appDataPath, "settings.json"),
      checkedAt,
    ),
  };
}

async function diagnoseDirectory(
  path: string,
  checkedAt: string,
): Promise<PathDiagnostics> {
  try {
    await mkdir(path, { recursive: true });
    await access(path, constants.R_OK | constants.W_OK);
    await writeProbeFile(path);

    return {
      status: "success",
      message: "Папка доступна для чтения и записи.",
      details: null,
      checkedAt,
    };
  } catch (error) {
    return {
      status: "error",
      message: "Папка недоступна для чтения или записи.",
      details:
        error instanceof Error
          ? limitText(error.message)
          : limitText(String(error)),
      checkedAt,
    };
  }
}

async function diagnoseSettingsFile(
  path: string,
  checkedAt: string,
): Promise<PathDiagnostics> {
  try {
    await access(path, constants.R_OK | constants.W_OK);

    return {
      status: "success",
      message: "Файл настроек доступен для чтения и записи.",
      details: null,
      checkedAt,
    };
  } catch (error) {
    return {
      status: "error",
      message: "Файл настроек недоступен для чтения или записи.",
      details:
        error instanceof Error
          ? limitText(error.message)
          : limitText(String(error)),
      checkedAt,
    };
  }
}

async function writeProbeFile(directory: string): Promise<void> {
  const probePath = resolve(
    directory,
    `.pilot-tracker-diagnostic-${process.pid}-${randomUUID()}.tmp`,
  );
  await writeFile(probePath, "ok", "utf8");
  await rm(probePath, { force: true });
}

async function diagnoseTools(
  tools: AppSettings["tools"],
  runner: DiagnosticCommandRunner,
  checkedAt: string,
): Promise<AppSettings["tools"]> {
  const git = await diagnoseRequiredVersionTool({
    command: tools.git.command,
    args: ["--version"],
    runner,
    checkedAt,
    successMessage: "Git доступен.",
    errorMessage:
      "Git недоступен. Проверьте установку Git или команду в настройках.",
  });

  const gh = await diagnoseGitHubCli(tools.gh.command, runner, checkedAt);

  const codex = await diagnoseRequiredVersionTool({
    command: tools.codex.command,
    args: ["--version"],
    runner,
    checkedAt,
    successMessage: "Codex CLI доступен.",
    errorMessage:
      "Codex CLI недоступен. ИИ-анализ нельзя будет запустить до исправления.",
  });

  const code = await diagnoseRequiredVersionTool({
    command: tools.code.command,
    args: ["--version"],
    runner,
    checkedAt,
    successMessage: "VS Code доступен через команду code.",
    errorMessage:
      "Команда VS Code недоступна. Открытие кода может быть ограничено.",
  });

  return {
    git: { ...tools.git, ...git },
    gh: { ...tools.gh, ...gh },
    codex: { ...tools.codex, ...codex },
    code: { ...tools.code, ...code },
  };
}

async function diagnoseRequiredVersionTool({
  command,
  args,
  runner,
  checkedAt,
  successMessage,
  errorMessage,
}: {
  command: string;
  args: string[];
  runner: DiagnosticCommandRunner;
  checkedAt: string;
  successMessage: string;
  errorMessage: string;
}): Promise<Omit<ToolSettings, "command">> {
  const result = await runner(command, args, { timeoutMs: COMMAND_TIMEOUT_MS });

  if (result.exitCode === 0) {
    return {
      status: "success",
      version: extractVersionLine(result),
      message: successMessage,
      details: null,
      authStatus: "not_applicable",
      checkedAt,
    };
  }

  return {
    status: "error",
    version: extractVersionLine(result),
    message: errorMessage,
    details: describeCommandFailure(result),
    authStatus: "not_applicable",
    checkedAt,
  };
}

async function diagnoseGitHubCli(
  command: string,
  runner: DiagnosticCommandRunner,
  checkedAt: string,
): Promise<Omit<ToolSettings, "command">> {
  const versionResult = await runner(command, ["--version"], {
    timeoutMs: COMMAND_TIMEOUT_MS,
  });

  if (versionResult.exitCode !== 0) {
    return {
      status: "warning",
      version: extractVersionLine(versionResult),
      message:
        "GitHub CLI недоступен. Контекст pull request для ИИ-анализа будет ограничен.",
      details: describeCommandFailure(versionResult),
      authStatus: "unknown",
      checkedAt,
    };
  }

  const authResult = await runner(command, ["auth", "status"], {
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  const authStatus: ToolAuthStatus =
    authResult.exitCode === 0 ? "authenticated" : "unauthenticated";

  if (authResult.exitCode === 0) {
    return {
      status: "success",
      version: extractVersionLine(versionResult),
      message: "GitHub CLI доступен, локальная авторизация найдена.",
      details: null,
      authStatus,
      checkedAt,
    };
  }

  return {
    status: "warning",
    version: extractVersionLine(versionResult),
    message: "GitHub CLI доступен, но локальная авторизация не подтверждена.",
    details: describeCommandFailure(authResult),
    authStatus,
    checkedAt,
  };
}

export function runDiagnosticCommand(
  command: string,
  args: string[],
  options: {
    timeoutMs?: number;
  } = {},
): Promise<DiagnosticCommandResult> {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS;
    let stdout = "";
    let stderr = "";
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;
      child.kill("SIGTERM");
      resolveResult({
        exitCode: null,
        stdout,
        stderr,
        error: "Команда не завершилась за отведенное время.",
        timedOut: true,
      });
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = limitText(stdout + chunk.toString("utf8"));
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = limitText(stderr + chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeout);
      resolveResult({
        exitCode: null,
        stdout,
        stderr,
        error: error.message,
        timedOut: false,
      });
    });

    child.on("close", (exitCode) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeout);
      resolveResult({
        exitCode,
        stdout,
        stderr,
        error: null,
        timedOut: false,
      });
    });
  });
}

function extractVersionLine(result: DiagnosticCommandResult): string | null {
  return (
    [result.stdout, result.stderr]
      .join("\n")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? null
  );
}

function describeCommandFailure(result: DiagnosticCommandResult): string {
  const parts = [
    result.exitCode === null ? null : `Код выхода: ${result.exitCode}.`,
    result.timedOut ? "Команда превысила время ожидания." : null,
    result.error ? `Ошибка запуска: ${result.error}` : null,
    result.stderr.trim() ? `stderr: ${result.stderr.trim()}` : null,
    result.stdout.trim() ? `stdout: ${result.stdout.trim()}` : null,
  ].filter((part): part is string => part !== null);

  return limitText(parts.join(" "));
}

function limitText(value: string): string {
  if (value.length <= DETAILS_LIMIT) {
    return value;
  }

  return `${value.slice(0, DETAILS_LIMIT)}...`;
}

function toAppError(error: unknown): AppError {
  if (error instanceof StorageError) {
    return error.appError;
  }

  return normalizeUnknownError(error);
}
