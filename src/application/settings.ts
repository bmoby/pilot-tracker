import { getDefaultStorage } from "@/storage/app-storage";
import { StorageError } from "@/storage/storage-error";
import { failure, normalizeUnknownError, success, type AppError, type AppResult } from "@/shared/result";

export type SettingsOverview = {
  dataRoot: string;
  appDataPath: string;
  repositoriesPath: string;
  reviewCopiesPath: string;
  backupsPath: string;
  tools: {
    name: string;
    command: string;
    statusLabel: string;
  }[];
};

export async function getSettingsOverview(): Promise<AppResult<SettingsOverview>> {
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
      tools: [
        {
          name: "Git",
          command: settings.tools.git.command,
          statusLabel: "не проверялось",
        },
        {
          name: "GitHub CLI",
          command: settings.tools.gh.command,
          statusLabel: "не проверялось",
        },
        {
          name: "Codex CLI",
          command: settings.tools.codex.command,
          statusLabel: "не проверялось",
        },
        {
          name: "VS Code",
          command: settings.tools.code.command,
          statusLabel: "не проверялось",
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
