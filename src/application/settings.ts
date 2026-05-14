import type {
  AppSettings,
  DiagnosticsStatus,
  PathDiagnostics,
  ToolAuthStatus,
} from "@/domain/schemas";
import { getDefaultStorage } from "@/storage/app-storage";
import { StorageError } from "@/storage/storage-error";
import {
  failure,
  normalizeUnknownError,
  success,
  type AppError,
  type AppResult,
} from "@/shared/result";

export type SettingsOverview = {
  dataRoot: string;
  appDataPath: string;
  repositoriesPath: string;
  reviewCopiesPath: string;
  backupsPath: string;
  paths: {
    key: string;
    name: string;
    value: string;
    status: DiagnosticsStatus;
    statusLabel: string;
    message: string | null;
    details: string | null;
    checkedAt: string | null;
  }[];
  tools: {
    key: string;
    name: string;
    command: string;
    status: DiagnosticsStatus;
    statusLabel: string;
    version: string | null;
    message: string | null;
    details: string | null;
    authStatus: ToolAuthStatus;
    authStatusLabel: string | null;
    checkedAt: string | null;
  }[];
};

export async function getSettingsOverview(): Promise<
  AppResult<SettingsOverview>
> {
  try {
    const storage = getDefaultStorage();
    const data = await storage.load();
    const settings = data.settingsFile.settings;

    return success({
      dataRoot: settings.dataRoot,
      appDataPath: `${settings.dataRoot}/${settings.appDataPath}`,
      repositoriesPath: `${settings.dataRoot}/${settings.repositoriesPath}`,
      reviewCopiesPath: `${settings.dataRoot}/${settings.reviewCopiesPath}`,
      backupsPath: `${settings.dataRoot}/${settings.backupsPath}`,
      paths: buildPathItems(settings),
      tools: [
        {
          key: "git",
          name: "Git",
          command: settings.tools.git.command,
          ...buildToolOverview(settings.tools.git),
        },
        {
          key: "gh",
          name: "GitHub CLI",
          command: settings.tools.gh.command,
          ...buildToolOverview(settings.tools.gh),
        },
        {
          key: "codex",
          name: "Codex CLI",
          command: settings.tools.codex.command,
          ...buildToolOverview(settings.tools.codex),
        },
        {
          key: "code",
          name: "VS Code",
          command: settings.tools.code.command,
          ...buildToolOverview(settings.tools.code),
        },
      ],
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

function toAppError(error: unknown): AppError {
  if (error instanceof StorageError) {
    return error.appError;
  }

  return normalizeUnknownError(error);
}

function buildPathItems(settings: AppSettings): SettingsOverview["paths"] {
  const paths = settings.paths;

  return [
    {
      key: "dataRoot",
      name: "Базовая папка данных",
      value: settings.dataRoot,
      ...buildPathOverview(paths?.dataRoot),
    },
    {
      key: "appData",
      name: "JSON-данные",
      value: `${settings.dataRoot}/${settings.appDataPath}`,
      ...buildPathOverview(paths?.appData),
    },
    {
      key: "repositories",
      name: "Репозитории",
      value: `${settings.dataRoot}/${settings.repositoriesPath}`,
      ...buildPathOverview(paths?.repositories),
    },
    {
      key: "reviewCopies",
      name: "Review-копии",
      value: `${settings.dataRoot}/${settings.reviewCopiesPath}`,
      ...buildPathOverview(paths?.reviewCopies),
    },
    {
      key: "backups",
      name: "Будущие резервные копии",
      value: `${settings.dataRoot}/${settings.backupsPath}`,
      ...buildPathOverview(paths?.backups),
    },
    {
      key: "settingsFile",
      name: "Файл настроек",
      value: `${settings.dataRoot}/${settings.appDataPath}/settings.json`,
      ...buildPathOverview(paths?.settingsFile),
    },
  ];
}

function buildToolOverview(
  tool: AppSettings["tools"][keyof AppSettings["tools"]],
) {
  return {
    status: tool.status,
    statusLabel: formatStatus(tool.status),
    version: tool.version,
    message: tool.message,
    details: tool.details,
    authStatus: tool.authStatus,
    authStatusLabel: formatAuthStatus(tool.authStatus),
    checkedAt: tool.checkedAt,
  };
}

function buildPathOverview(path: PathDiagnostics | undefined) {
  const diagnostics = path ?? createUnknownPathDiagnostics();

  return {
    status: diagnostics.status,
    statusLabel: formatStatus(diagnostics.status),
    message: diagnostics.message,
    details: diagnostics.details,
    checkedAt: diagnostics.checkedAt,
  };
}

function createUnknownPathDiagnostics(): PathDiagnostics {
  return {
    status: "unknown",
    message: null,
    details: null,
    checkedAt: null,
  };
}

function formatStatus(status: DiagnosticsStatus): string {
  const labels: Record<DiagnosticsStatus, string> = {
    unknown: "не проверялось",
    running: "проверяется",
    success: "успешно",
    warning: "предупреждение",
    error: "ошибка",
  };

  return labels[status];
}

function formatAuthStatus(status: ToolAuthStatus): string | null {
  const labels: Record<ToolAuthStatus, string | null> = {
    not_applicable: null,
    unknown: "авторизация не проверена",
    authenticated: "авторизация найдена",
    unauthenticated: "авторизация не подтверждена",
  };

  return labels[status];
}
