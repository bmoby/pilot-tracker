import type {
  AiAnalysisJob,
  AppData,
  Project,
  ProjectStatus,
  Student,
  UpdateEvent,
} from "@/domain/schemas";
import {
  aiAnalysisJobStatusLabels,
  projectStatusLabels,
  updateEventResultLabels,
} from "@/domain/schemas";
import { getAiAnalysisBlockedReason } from "@/application/ai-analysis";
import { startAiAnalysisQueueWorker } from "@/application/ai-analysis-queue";
import { summarizeUpdateEvents } from "@/domain/update-rules";
import {
  createStudentAndProject,
  createUtcTimestamp,
  getProjectStatusForRepositoryUrl,
  normalizeStudentInput,
  type StudentInput,
} from "@/domain/student-rules";
import { getLatestUpdateRun, type UpdateRunListItem } from "@/application/project-updates";
import { getDefaultStorage } from "@/storage/app-storage";
import { StorageError } from "@/storage/storage-error";
import { failure, normalizeUnknownError, success, type AppError, type AppResult } from "@/shared/result";

export type StudentListItem = {
  studentId: string;
  projectId: string;
  displayName: string;
  notes: string | null;
  repositoryUrl: string | null;
  localPath: string | null;
  lastUpdatedAt: string | null;
  lastKnownCommit: string | null;
  lastUpdateResult: string | null;
  lastUpdateResultLabel: string | null;
  lastNewCommitsCount: number | null;
  lastAiAnalysisJobStatus: AiAnalysisJob["status"] | null;
  lastAiAnalysisJobStatusLabel: string | null;
  lastAiAnalysisJobUpdatedAt: string | null;
  lastError: string | null;
  status: ProjectStatus;
  statusLabel: string;
};

export type StudentsPageData = {
  students: StudentListItem[];
  latestUpdateRun: UpdateRunListItem | null;
  aiAnalysisQueueCandidateCount: number;
  activeAiAnalysisJobsCount: number;
};

export type UpdateStudentInput = StudentInput & {
  studentId: string;
};

export type DeleteStudentInput = {
  studentId: string;
  confirmed: boolean;
};

export async function listStudents(storage = getDefaultStorage()): Promise<AppResult<StudentsPageData>> {
  try {
    const data = await storage.load();
    const activeAiAnalysisJobsCount = countActiveAiAnalysisJobs(data);

    if (activeAiAnalysisJobsCount > 0) {
      startAiAnalysisQueueWorker(storage);
    }

    return success({
      students: buildStudentList(data),
      latestUpdateRun: getLatestUpdateRun(data),
      aiAnalysisQueueCandidateCount: countAiAnalysisQueueCandidates(data),
      activeAiAnalysisJobsCount,
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function createStudent(
  input: StudentInput,
  storage = getDefaultStorage(),
): Promise<AppResult<StudentsPageData>> {
  try {
    const normalized = normalizeStudentInput(input);

    if (!normalized.ok) {
      return failure({
        code: "student_validation_error",
        message: normalized.message,
      });
    }

    const data = await storage.load();
    const now = createUtcTimestamp();
    const { student, project } = createStudentAndProject(normalized.value, now);

    data.studentsFile.students.push(student);
    data.projectsFile.projects.push(project);

    await storage.saveFiles(data, ["studentsFile", "projectsFile"]);

    return success({
      students: buildStudentList(data),
      latestUpdateRun: getLatestUpdateRun(data),
      aiAnalysisQueueCandidateCount: countAiAnalysisQueueCandidates(data),
      activeAiAnalysisJobsCount: countActiveAiAnalysisJobs(data),
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function updateStudent(
  input: UpdateStudentInput,
  storage = getDefaultStorage(),
): Promise<AppResult<StudentsPageData>> {
  try {
    const normalized = normalizeStudentInput(input);

    if (!normalized.ok) {
      return failure({
        code: "student_validation_error",
        message: normalized.message,
      });
    }

    const data = await storage.load();
    const student = findStudent(data, input.studentId);

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

    const repositoryChanged = project.repositoryUrl !== normalized.value.repositoryUrl;
    const projectHasLoadedState = project.localPath !== null || project.lastKnownCommit !== null;

    if (repositoryChanged && projectHasLoadedState) {
      return failure({
        code: "repository_replacement_not_allowed",
        message:
          "Ссылка GitHub уже связана с загруженным проектом. Замена репозитория требует отдельного решения спецификации.",
      });
    }

    const now = createUtcTimestamp();
    student.displayName = normalized.value.displayName;
    student.notes = normalized.value.notes;
    student.updatedAt = now;

    if (repositoryChanged) {
      project.repositoryUrl = normalized.value.repositoryUrl;
      project.status = getProjectStatusForRepositoryUrl(project.repositoryUrl);
      project.lastError = null;
    }

    project.updatedAt = now;

    await storage.saveFiles(data, ["studentsFile", "projectsFile"]);

    return success({
      students: buildStudentList(data),
      latestUpdateRun: getLatestUpdateRun(data),
      aiAnalysisQueueCandidateCount: countAiAnalysisQueueCandidates(data),
      activeAiAnalysisJobsCount: countActiveAiAnalysisJobs(data),
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function deleteStudent(
  input: DeleteStudentInput,
  storage = getDefaultStorage(),
): Promise<AppResult<StudentsPageData>> {
  try {
    if (!input.confirmed) {
      return failure({
        code: "delete_confirmation_required",
        message: "Удаление студента требует подтверждения.",
      });
    }

    const data = await storage.load();
    const student = findStudent(data, input.studentId);

    if (student === null) {
      return failure({
        code: "student_not_found",
        message: "Студент не найден.",
      });
    }

    const project = findProject(data, student.projectId);
    const projectId = project?.id ?? student.projectId;
    const removedUpdateIds = new Set(
      data.updateEventsFile.updateEvents
        .filter((event) => event.studentId === student.id || event.projectId === projectId)
        .map((event) => event.id),
    );

    data.studentsFile.students = data.studentsFile.students.filter((item) => item.id !== student.id);
    data.projectsFile.projects = data.projectsFile.projects.filter((item) => item.id !== projectId);
    data.updateEventsFile.updateEvents = data.updateEventsFile.updateEvents.filter(
      (event) => event.studentId !== student.id && event.projectId !== projectId,
    );
    const remainingRunIds = new Set(data.updateEventsFile.updateEvents.map((event) => event.runId));
    data.updateRunsFile.updateRuns = data.updateRunsFile.updateRuns.filter((run) =>
      remainingRunIds.has(run.id),
    );
    for (const run of data.updateRunsFile.updateRuns) {
      const runEvents = data.updateEventsFile.updateEvents.filter((event) => event.runId === run.id);
      run.summary = summarizeUpdateEvents(runEvents, data.studentsFile.students.length);
    }
    data.commentsFile.comments = data.commentsFile.comments.filter(
      (comment) => !removedUpdateIds.has(comment.updateEventId),
    );
    data.reviewStatusesFile.reviewStatuses = data.reviewStatusesFile.reviewStatuses.filter(
      (status) => !removedUpdateIds.has(status.updateEventId),
    );
    data.aiAnalysisJobsFile.aiAnalysisJobs =
      data.aiAnalysisJobsFile.aiAnalysisJobs.filter(
        (job) => !removedUpdateIds.has(job.updateEventId),
      );
    data.aiReportsFile.aiReports = data.aiReportsFile.aiReports.filter(
      (report) => !removedUpdateIds.has(getStringField(report, "updateEventId") ?? ""),
    );

    await storage.saveFiles(data, [
      "studentsFile",
      "projectsFile",
      "updateRunsFile",
      "updateEventsFile",
      "commentsFile",
      "reviewStatusesFile",
      "aiAnalysisJobsFile",
      "aiReportsFile",
    ]);

    return success({
      students: buildStudentList(data),
      latestUpdateRun: getLatestUpdateRun(data),
      aiAnalysisQueueCandidateCount: countAiAnalysisQueueCandidates(data),
      activeAiAnalysisJobsCount: countActiveAiAnalysisJobs(data),
    });
  } catch (error) {
    return failure(toAppError(error));
  }
}

function buildStudentList(data: AppData): StudentListItem[] {
  return data.studentsFile.students
    .map((student) => {
      const project = findProject(data, student.projectId);

      if (project === null) {
        return null;
      }

      return toStudentListItem(data, student, project);
    })
    .filter((item): item is StudentListItem => item !== null)
    .sort(compareStudents);
}

function toStudentListItem(data: AppData, student: Student, project: Project): StudentListItem {
  const lastUpdate = findLastProjectUpdate(data, student.id, project.id);
  const lastAiAnalysisJob =
    lastUpdate === null ? null : findLatestAiAnalysisJob(data, lastUpdate.id);

  return {
    studentId: student.id,
    projectId: project.id,
    displayName: student.displayName,
    notes: student.notes,
    repositoryUrl: project.repositoryUrl,
    localPath: project.localPath,
    lastUpdatedAt: project.lastUpdatedAt,
    lastKnownCommit: project.lastKnownCommit,
    lastUpdateResult: lastUpdate?.result ?? null,
    lastUpdateResultLabel:
      lastUpdate?.result === undefined || lastUpdate.result === null
        ? null
        : updateEventResultLabels[lastUpdate.result],
    lastNewCommitsCount: lastUpdate?.newCommitsCount ?? null,
    lastAiAnalysisJobStatus: lastAiAnalysisJob?.status ?? null,
    lastAiAnalysisJobStatusLabel:
      lastAiAnalysisJob === null
        ? null
        : aiAnalysisJobStatusLabels[lastAiAnalysisJob.status],
    lastAiAnalysisJobUpdatedAt: lastAiAnalysisJob?.updatedAt ?? null,
    lastError: project.lastError,
    status: project.status,
    statusLabel: projectStatusLabels[project.status],
  };
}

function countAiAnalysisQueueCandidates(data: AppData): number {
  return data.projectsFile.projects.filter((project) => {
    if (project.lastUpdateEventId === null) {
      return false;
    }

    const event = findUpdateEvent(data, project.lastUpdateEventId);

    if (event === null || getAiAnalysisBlockedReason(data, event) !== null) {
      return false;
    }

    if (findActiveAiAnalysisJob(data, event.id) !== null) {
      return false;
    }

    return !data.aiReportsFile.aiReports.some(
      (report) =>
        report.updateEventId === event.id &&
        (report.status === "ready" || report.status === "running"),
    );
  }).length;
}

function countActiveAiAnalysisJobs(data: AppData): number {
  return data.aiAnalysisJobsFile.aiAnalysisJobs.filter(
    (job) => job.status === "queued" || job.status === "running",
  ).length;
}

function findLatestAiAnalysisJob(
  data: AppData,
  updateEventId: string,
): AiAnalysisJob | null {
  return (
    data.aiAnalysisJobsFile.aiAnalysisJobs
      .filter((job) => job.updateEventId === updateEventId)
      .sort(compareAiAnalysisJobs)[0] ?? null
  );
}

function findActiveAiAnalysisJob(
  data: AppData,
  updateEventId: string,
): AiAnalysisJob | null {
  return (
    data.aiAnalysisJobsFile.aiAnalysisJobs.find(
      (job) =>
        job.updateEventId === updateEventId &&
        (job.status === "queued" || job.status === "running"),
    ) ?? null
  );
}

function compareAiAnalysisJobs(
  left: AiAnalysisJob,
  right: AiAnalysisJob,
): number {
  const leftActive = left.status === "queued" || left.status === "running";
  const rightActive = right.status === "queued" || right.status === "running";

  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }

  return right.requestedAt.localeCompare(left.requestedAt);
}

function findLastProjectUpdate(data: AppData, studentId: string, projectId: string): UpdateEvent | null {
  return (
    data.updateEventsFile.updateEvents
      .filter((event) => event.studentId === studentId && event.projectId === projectId)
      .sort((left, right) =>
        (right.occurredAt ?? right.startedAt).localeCompare(left.occurredAt ?? left.startedAt),
      )[0] ?? null
  );
}

function findUpdateEvent(data: AppData, updateEventId: string): UpdateEvent | null {
  return data.updateEventsFile.updateEvents.find((event) => event.id === updateEventId) ?? null;
}

function compareStudents(left: StudentListItem, right: StudentListItem): number {
  const groupDifference = getStudentPriority(left.status) - getStudentPriority(right.status);

  if (groupDifference !== 0) {
    return groupDifference;
  }

  return left.displayName.localeCompare(right.displayName, "ru");
}

function getStudentPriority(status: ProjectStatus): number {
  if (status === "first_loaded" || status === "has_changes") {
    return 0;
  }

  if (
    status === "update_error" ||
    status === "local_copy_missing" ||
    status === "local_copy_unavailable" ||
    status === "repository_unavailable"
  ) {
    return 1;
  }

  if (status === "not_connected" || status === "never_updated" || status === "updating") {
    return 2;
  }

  return 3;
}

function findStudent(data: AppData, studentId: string): Student | null {
  return data.studentsFile.students.find((student) => student.id === studentId) ?? null;
}

function findProject(data: AppData, projectId: string): Project | null {
  return data.projectsFile.projects.find((project) => project.id === projectId) ?? null;
}

function getStringField(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  return typeof value === "string" ? value : null;
}

function toAppError(error: unknown): AppError {
  if (error instanceof StorageError) {
    return error.appError;
  }

  return normalizeUnknownError(error);
}
