import type { AppData, Project, ProjectStatus, Student } from "@/domain/schemas";
import { projectStatusLabels } from "@/domain/schemas";
import {
  createStudentAndProject,
  createUtcTimestamp,
  getProjectStatusForRepositoryUrl,
  normalizeStudentInput,
  type StudentInput,
} from "@/domain/student-rules";
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
  lastError: string | null;
  status: ProjectStatus;
  statusLabel: string;
};

export type StudentsPageData = {
  students: StudentListItem[];
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

    return success({
      students: buildStudentList(data),
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
    project.repositoryUrl = normalized.value.repositoryUrl;
    project.status = getProjectStatusForRepositoryUrl(project.repositoryUrl);
    project.lastError = null;
    project.updatedAt = now;

    await storage.saveFiles(data, ["studentsFile", "projectsFile"]);

    return success({
      students: buildStudentList(data),
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
        .filter(
          (event) =>
            getStringField(event, "studentId") === student.id ||
            getStringField(event, "projectId") === projectId,
        )
        .map((event) => getStringField(event, "id"))
        .filter((id): id is string => id !== null),
    );

    data.studentsFile.students = data.studentsFile.students.filter((item) => item.id !== student.id);
    data.projectsFile.projects = data.projectsFile.projects.filter((item) => item.id !== projectId);
    data.updateEventsFile.updateEvents = data.updateEventsFile.updateEvents.filter(
      (event) =>
        getStringField(event, "studentId") !== student.id &&
        getStringField(event, "projectId") !== projectId,
    );
    data.commentsFile.comments = data.commentsFile.comments.filter(
      (comment) => !removedUpdateIds.has(getStringField(comment, "updateEventId") ?? ""),
    );
    data.reviewStatusesFile.reviewStatuses = data.reviewStatusesFile.reviewStatuses.filter(
      (status) => !removedUpdateIds.has(getStringField(status, "updateEventId") ?? ""),
    );
    data.aiReportsFile.aiReports = data.aiReportsFile.aiReports.filter(
      (report) => !removedUpdateIds.has(getStringField(report, "updateEventId") ?? ""),
    );

    await storage.saveFiles(data, [
      "studentsFile",
      "projectsFile",
      "updateEventsFile",
      "commentsFile",
      "reviewStatusesFile",
      "aiReportsFile",
    ]);

    return success({
      students: buildStudentList(data),
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

      return toStudentListItem(student, project);
    })
    .filter((item): item is StudentListItem => item !== null)
    .sort(compareStudents);
}

function toStudentListItem(student: Student, project: Project): StudentListItem {
  return {
    studentId: student.id,
    projectId: project.id,
    displayName: student.displayName,
    notes: student.notes,
    repositoryUrl: project.repositoryUrl,
    localPath: project.localPath,
    lastUpdatedAt: project.lastUpdatedAt,
    lastError: project.lastError,
    status: project.status,
    statusLabel: projectStatusLabels[project.status],
  };
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

  return 2;
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
