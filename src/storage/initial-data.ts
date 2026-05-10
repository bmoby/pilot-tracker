import type {
  AiReportsFile,
  AppSettings,
  CommentsFile,
  ProjectsFile,
  ReviewStatusesFile,
  SettingsFile,
  StudentsFile,
  UpdateEventsFile,
  UpdateRunsFile,
} from "@/domain/schemas";
import { SCHEMA_VERSION } from "@/domain/schemas";

function createInitialTool(command: string) {
  return {
    command,
    status: "unknown" as const,
    version: null,
    message: null,
    checkedAt: null,
  };
}

export function createInitialSettings(): AppSettings {
  return {
    dataRoot: "data",
    appDataPath: "app",
    repositoriesPath: "repositories",
    reviewCopiesPath: "review-copies",
    backupsPath: "backups",
    tools: {
      git: createInitialTool("git"),
      gh: createInitialTool("gh"),
      codex: createInitialTool("codex"),
      code: createInitialTool("code"),
    },
  };
}

export function createInitialStudentsFile(): StudentsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    students: [],
  };
}

export function createInitialProjectsFile(): ProjectsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    projects: [],
  };
}

export function createInitialUpdateRunsFile(): UpdateRunsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    updateRuns: [],
  };
}

export function createInitialUpdateEventsFile(): UpdateEventsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    updateEvents: [],
  };
}

export function createInitialCommentsFile(): CommentsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    comments: [],
  };
}

export function createInitialReviewStatusesFile(): ReviewStatusesFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    reviewStatuses: [],
  };
}

export function createInitialAiReportsFile(): AiReportsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    aiReports: [],
  };
}

export function createInitialSettingsFile(): SettingsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: createInitialSettings(),
  };
}
