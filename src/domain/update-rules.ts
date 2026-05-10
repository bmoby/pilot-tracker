import { createPrefixedId } from "./ids";
import type {
  Project,
  ProjectStatus,
  ReviewStatus,
  Student,
  UpdateEvent,
  UpdateEventResult,
  UpdateRun,
  UpdateRunScope,
  UpdateRunSummary,
} from "./schemas";

export type GitUpdateErrorCategory =
  | "repo_url_invalid"
  | "repo_access_denied"
  | "repo_not_found"
  | "network_error"
  | "git_not_available"
  | "main_branch_missing"
  | "local_path_missing"
  | "local_path_not_repository"
  | "local_repository_dirty"
  | "local_repository_corrupted"
  | "history_rewritten"
  | "git_command_failed";

export type GitUpdateError = {
  category: GitUpdateErrorCategory;
  message: string;
  technicalDetails?: string;
  command?: string;
  exitCode?: number | null;
};

export function createEmptyUpdateRunSummary(studentsTotal: number): UpdateRunSummary {
  return {
    studentsTotal,
    projectsAttempted: 0,
    projectsFirstLoaded: 0,
    projectsWithChanges: 0,
    newCommitsTotal: 0,
    projectsWithoutChanges: 0,
    errorsTotal: 0,
    studentsWithoutRepository: 0,
  };
}

export function createUpdateRun({
  scope,
  studentId,
  projectId,
  studentsTotal,
  now,
}: {
  scope: UpdateRunScope;
  studentId: string | null;
  projectId: string | null;
  studentsTotal: number;
  now: string;
}): UpdateRun {
  return {
    id: createPrefixedId("run"),
    scope,
    studentId,
    projectId,
    status: "running",
    startedAt: now,
    finishedAt: null,
    summary: createEmptyUpdateRunSummary(studentsTotal),
    error: null,
  };
}

export function createRunningUpdateEvent({
  runId,
  student,
  project,
  now,
}: {
  runId: string;
  student: Student;
  project: Project;
  now: string;
}): UpdateEvent {
  return {
    id: createPrefixedId("update"),
    runId,
    studentId: student.id,
    projectId: project.id,
    status: "running",
    startedAt: now,
    finishedAt: null,
    occurredAt: null,
    repositoryUrlSnapshot: project.repositoryUrl,
    projectLocalPathSnapshot: project.localPath,
    branch: "main",
    previousCommit: project.lastKnownCommit,
    newCommit: null,
    newCommitsCount: null,
    hasNewChanges: false,
    result: null,
    error: null,
    analysisBoundaryRecordedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialReviewStatus(event: UpdateEvent, now: string): ReviewStatus {
  return {
    id: createPrefixedId("review_status"),
    studentId: event.studentId,
    projectId: event.projectId,
    updateEventId: event.id,
    status: "not_reviewed",
    createdAt: now,
    updatedAt: now,
  };
}

export function completeUpdateEvent({
  event,
  result,
  now,
  localPath,
  previousCommit,
  newCommit,
  newCommitsCount,
  hasNewChanges,
  error,
}: {
  event: UpdateEvent;
  result: UpdateEventResult;
  now: string;
  localPath: string | null;
  previousCommit: string | null;
  newCommit: string | null;
  newCommitsCount: number | null;
  hasNewChanges: boolean;
  error: string | null;
}): void {
  event.status = result === "error" ? "failed" : "completed";
  event.finishedAt = now;
  event.occurredAt = now;
  event.projectLocalPathSnapshot = localPath;
  event.previousCommit = previousCommit;
  event.newCommit = newCommit;
  event.newCommitsCount = newCommitsCount;
  event.hasNewChanges = hasNewChanges;
  event.result = result;
  event.error = error;
  event.analysisBoundaryRecordedAt = newCommit === null ? null : now;
  event.updatedAt = now;
}

export function applyEventToProject({
  project,
  event,
  status,
  now,
  localPath,
  currentBranch,
  lastKnownCommit,
  lastError,
}: {
  project: Project;
  event: UpdateEvent;
  status: ProjectStatus;
  now: string;
  localPath: string | null;
  currentBranch: string | null;
  lastKnownCommit: string | null;
  lastError: string | null;
}): void {
  project.status = status;
  project.localPath = localPath;
  project.currentBranch = currentBranch;
  project.lastKnownCommit = lastKnownCommit;
  project.lastUpdatedAt = event.occurredAt ?? now;
  project.lastUpdateEventId = event.id;
  project.lastError = lastError;
  project.updatedAt = now;
}

export function summarizeUpdateEvents(events: UpdateEvent[], studentsTotal: number): UpdateRunSummary {
  return events.reduce((summary, event) => {
    if (event.result !== "skipped_no_repository") {
      summary.projectsAttempted += 1;
    }

    if (event.result === "skipped_no_repository") {
      summary.studentsWithoutRepository += 1;
    }

    if (event.result === "cloned") {
      summary.projectsFirstLoaded += 1;
    }

    if (event.result === "updated_with_changes") {
      summary.projectsWithChanges += 1;
      summary.newCommitsTotal += event.newCommitsCount ?? 0;
    }

    if (event.result === "updated_no_changes") {
      summary.projectsWithoutChanges += 1;
    }

    if (event.result === "error") {
      summary.errorsTotal += 1;
    }

    return summary;
  }, createEmptyUpdateRunSummary(studentsTotal));
}

export function getRunStatusFromSummary(summary: UpdateRunSummary): UpdateRun["status"] {
  return summary.errorsTotal > 0 ? "completed_with_errors" : "completed";
}

export function getProjectStatusForError(category: GitUpdateErrorCategory): ProjectStatus {
  if (category === "local_path_missing") {
    return "local_copy_missing";
  }

  if (
    category === "local_path_not_repository" ||
    category === "local_repository_dirty" ||
    category === "local_repository_corrupted"
  ) {
    return "local_copy_unavailable";
  }

  if (
    category === "repo_url_invalid" ||
    category === "repo_access_denied" ||
    category === "repo_not_found" ||
    category === "network_error" ||
    category === "main_branch_missing"
  ) {
    return "repository_unavailable";
  }

  return "update_error";
}
