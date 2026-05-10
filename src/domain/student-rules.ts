import { randomUUID } from "node:crypto";
import type { Project, ProjectStatus, Student } from "./schemas";

export type StudentInput = {
  displayName: string;
  notes?: string | null;
  repositoryUrl?: string | null;
};

export type NormalizedStudentInput = {
  displayName: string;
  notes: string | null;
  repositoryUrl: string | null;
};

export type StudentValidationResult =
  | {
      ok: true;
      value: NormalizedStudentInput;
    }
  | {
      ok: false;
      message: string;
    };

export function normalizeStudentInput(input: StudentInput): StudentValidationResult {
  const displayName = input.displayName.trim();
  const notes = normalizeOptionalText(input.notes);
  const repositoryUrl = normalizeOptionalText(input.repositoryUrl);

  if (displayName.length === 0) {
    return {
      ok: false,
      message: "Имя студента обязательно.",
    };
  }

  if (repositoryUrl !== null && !isGithubRepositoryUrl(repositoryUrl)) {
    return {
      ok: false,
      message: "Ссылка должна выглядеть как ссылка на репозиторий GitHub.",
    };
  }

  return {
    ok: true,
    value: {
      displayName,
      notes,
      repositoryUrl,
    },
  };
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isGithubRepositoryUrl(value: string): boolean {
  const normalized = value.trim();
  const httpsPattern = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?\/?$/i;
  const sshPattern = /^git@github\.com:[^/\s]+\/[^/\s]+(?:\.git)?$/i;

  return httpsPattern.test(normalized) || sshPattern.test(normalized);
}

export function createStudentAndProject(input: NormalizedStudentInput, now: string) {
  const studentId = createPrefixedId("student");
  const projectId = createPrefixedId("project");
  const status: ProjectStatus = input.repositoryUrl === null ? "not_connected" : "never_updated";

  const student: Student = {
    id: studentId,
    displayName: input.displayName,
    notes: input.notes,
    projectId,
    createdAt: now,
    updatedAt: now,
  };

  const project: Project = {
    id: projectId,
    studentId,
    repositoryUrl: input.repositoryUrl,
    localPath: null,
    defaultBranch: "main",
    currentBranch: null,
    lastKnownCommit: null,
    lastUpdatedAt: null,
    lastUpdateEventId: null,
    status,
    lastError: null,
    aiDescription: {
      status: "missing",
      summary: null,
      idea: null,
      keyParts: [],
      sourceAiReportId: null,
      sourceCommit: null,
      updatedAt: null,
      error: null,
    },
    createdAt: now,
    updatedAt: now,
  };

  return {
    student,
    project,
  };
}

export function getProjectStatusForRepositoryUrl(repositoryUrl: string | null): ProjectStatus {
  return repositoryUrl === null ? "not_connected" : "never_updated";
}

export function createUtcTimestamp(): string {
  return new Date().toISOString();
}

function createPrefixedId(prefix: string): `${string}_${string}` {
  return `${prefix}_${randomUUID()}`;
}
