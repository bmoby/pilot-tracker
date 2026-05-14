import { resolve } from "node:path";
import type { z } from "zod";
import {
  aiReportsFileSchema,
  commentsFileSchema,
  type AppData,
  projectsFileSchema,
  reviewStatusesFileSchema,
  settingsFileSchema,
  studentsFileSchema,
  updateEventsFileSchema,
  updateRunsFileSchema,
} from "@/domain/schemas";
import {
  createInitialAiReportsFile,
  createInitialCommentsFile,
  createInitialProjectsFile,
  createInitialReviewStatusesFile,
  createInitialSettingsFile,
  createInitialStudentsFile,
  createInitialUpdateEventsFile,
  createInitialUpdateRunsFile,
} from "./initial-data";
import {
  ensureDirectory,
  pathExists,
  readJsonFile,
  safeWriteJsonFile,
} from "./file-system";
import { createStorageError } from "./storage-error";

type AppFileKey = keyof AppData;

type AppFileDefinition<T> = {
  fileName: string;
  schema: z.ZodType<T>;
  createInitialData: () => T;
};

const APP_FILE_DEFINITIONS = {
  studentsFile: {
    fileName: "students.json",
    schema: studentsFileSchema,
    createInitialData: createInitialStudentsFile,
  },
  projectsFile: {
    fileName: "projects.json",
    schema: projectsFileSchema,
    createInitialData: createInitialProjectsFile,
  },
  updateRunsFile: {
    fileName: "update-runs.json",
    schema: updateRunsFileSchema,
    createInitialData: createInitialUpdateRunsFile,
  },
  updateEventsFile: {
    fileName: "update-events.json",
    schema: updateEventsFileSchema,
    createInitialData: createInitialUpdateEventsFile,
  },
  commentsFile: {
    fileName: "comments.json",
    schema: commentsFileSchema,
    createInitialData: createInitialCommentsFile,
  },
  reviewStatusesFile: {
    fileName: "review-statuses.json",
    schema: reviewStatusesFileSchema,
    createInitialData: createInitialReviewStatusesFile,
  },
  aiReportsFile: {
    fileName: "ai-reports.json",
    schema: aiReportsFileSchema,
    createInitialData: createInitialAiReportsFile,
  },
  settingsFile: {
    fileName: "settings.json",
    schema: settingsFileSchema,
    createInitialData: createInitialSettingsFile,
  },
} satisfies {
  [Key in AppFileKey]: AppFileDefinition<AppData[Key]>;
};

export type AppStorageOptions = {
  projectRoot?: string;
  dataRoot?: "data";
};

export class AppStorage {
  private readonly projectRoot: string;
  private readonly dataRootName: "data";
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: AppStorageOptions = {}) {
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.dataRootName = options.dataRoot ?? "data";
  }

  get dataRootPath() {
    return resolve(this.projectRoot, this.dataRootName);
  }

  get appDataPath() {
    return resolve(this.dataRootPath, "app");
  }

  get repositoriesPath() {
    return resolve(this.dataRootPath, "repositories");
  }

  get reviewCopiesPath() {
    return resolve(this.dataRootPath, "review-copies");
  }

  get logsPath() {
    return resolve(this.dataRootPath, "logs");
  }

  get backupsPath() {
    return resolve(this.dataRootPath, "backups");
  }

  async load(): Promise<AppData> {
    await this.initialize();

    const data: AppData = {
      studentsFile: await readJsonFile(
        this.getFilePath("students.json"),
        studentsFileSchema,
      ),
      projectsFile: await readJsonFile(
        this.getFilePath("projects.json"),
        projectsFileSchema,
      ),
      updateRunsFile: await readJsonFile(
        this.getFilePath("update-runs.json"),
        updateRunsFileSchema,
      ),
      updateEventsFile: await readJsonFile(
        this.getFilePath("update-events.json"),
        updateEventsFileSchema,
      ),
      commentsFile: await readJsonFile(
        this.getFilePath("comments.json"),
        commentsFileSchema,
      ),
      reviewStatusesFile: await readJsonFile(
        this.getFilePath("review-statuses.json"),
        reviewStatusesFileSchema,
      ),
      aiReportsFile: await readJsonFile(
        this.getFilePath("ai-reports.json"),
        aiReportsFileSchema,
      ),
      settingsFile: await readJsonFile(
        this.getFilePath("settings.json"),
        settingsFileSchema,
      ),
    };
    validateAppDataConsistency(data);

    return data;
  }

  async saveFiles(data: AppData, keys: AppFileKey[]): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      for (const key of keys) {
        const definition = APP_FILE_DEFINITIONS[key];
        await safeWriteJsonFile(
          this.getFilePath(definition.fileName),
          data[key],
          definition.schema,
        );
      }
    });

    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  private async initialize(): Promise<void> {
    await ensureDirectory(this.dataRootPath);
    await ensureDirectory(this.appDataPath);
    await ensureDirectory(this.repositoriesPath);
    await ensureDirectory(this.reviewCopiesPath);
    await ensureDirectory(this.logsPath);
    await ensureDirectory(this.backupsPath);

    for (const key of appFileKeys) {
      const definition = APP_FILE_DEFINITIONS[key];
      const filePath = this.getFilePath(definition.fileName);

      if (!(await pathExists(filePath))) {
        await safeWriteJsonFile(
          filePath,
          definition.createInitialData(),
          definition.schema,
        );
      }
    }
  }

  private getFilePath(fileName: string): string {
    return resolve(this.appDataPath, fileName);
  }
}

const appFileKeys = Object.keys(APP_FILE_DEFINITIONS) as AppFileKey[];

function validateAppDataConsistency(data: AppData): void {
  const studentIds = new Set(
    data.studentsFile.students.map((student) => student.id),
  );
  const projectIds = new Set(
    data.projectsFile.projects.map((project) => project.id),
  );
  const updateRunIds = new Set(
    data.updateRunsFile.updateRuns.map((run) => run.id),
  );
  const updateEventIds = new Set(
    data.updateEventsFile.updateEvents.map((event) => event.id),
  );
  const commentIds = new Set(
    data.commentsFile.comments.map((comment) => comment.id),
  );
  const aiReportIds = new Set(
    data.aiReportsFile.aiReports.map((report) => report.id),
  );
  const reviewStatusIds = new Set(
    data.reviewStatusesFile.reviewStatuses.map((status) => status.id),
  );
  const reviewStatusEventIds = new Set(
    data.reviewStatusesFile.reviewStatuses.map(
      (status) => status.updateEventId,
    ),
  );

  if (studentIds.size !== data.studentsFile.students.length) {
    throw createStorageError(
      "storage_consistency_error",
      "В данных студентов найдены повторяющиеся идентификаторы.",
    );
  }

  if (projectIds.size !== data.projectsFile.projects.length) {
    throw createStorageError(
      "storage_consistency_error",
      "В данных проектов найдены повторяющиеся идентификаторы.",
    );
  }

  if (updateRunIds.size !== data.updateRunsFile.updateRuns.length) {
    throw createStorageError(
      "storage_consistency_error",
      "В запусках обновления найдены повторяющиеся идентификаторы.",
    );
  }

  if (updateEventIds.size !== data.updateEventsFile.updateEvents.length) {
    throw createStorageError(
      "storage_consistency_error",
      "В событиях обновления найдены повторяющиеся идентификаторы.",
    );
  }

  if (reviewStatusIds.size !== data.reviewStatusesFile.reviewStatuses.length) {
    throw createStorageError(
      "storage_consistency_error",
      "В статусах проверки найдены повторяющиеся идентификаторы.",
    );
  }

  if (
    reviewStatusEventIds.size !== data.reviewStatusesFile.reviewStatuses.length
  ) {
    throw createStorageError(
      "storage_consistency_error",
      "Для одного события обновления найдено несколько статусов проверки.",
    );
  }

  if (commentIds.size !== data.commentsFile.comments.length) {
    throw createStorageError(
      "storage_consistency_error",
      "В комментариях проверки найдены повторяющиеся идентификаторы.",
    );
  }

  if (aiReportIds.size !== data.aiReportsFile.aiReports.length) {
    throw createStorageError(
      "storage_consistency_error",
      "В ИИ-рапортах найдены повторяющиеся идентификаторы.",
    );
  }

  for (const student of data.studentsFile.students) {
    const project = data.projectsFile.projects.find(
      (item) => item.id === student.projectId,
    );

    if (project === undefined) {
      throw createStorageError(
        "storage_consistency_error",
        "Связанный проект студента отсутствует в данных.",
      );
    }

    if (project.studentId !== student.id) {
      throw createStorageError(
        "storage_consistency_error",
        "Связь студента и проекта нарушена.",
      );
    }
  }

  for (const event of data.updateEventsFile.updateEvents) {
    if (!updateRunIds.has(event.runId)) {
      throw createStorageError(
        "storage_consistency_error",
        "Событие обновления ссылается на отсутствующий запуск.",
      );
    }

    const student = data.studentsFile.students.find(
      (item) => item.id === event.studentId,
    );
    const project = data.projectsFile.projects.find(
      (item) => item.id === event.projectId,
    );

    if (
      student === undefined ||
      project === undefined ||
      project.studentId !== student.id
    ) {
      throw createStorageError(
        "storage_consistency_error",
        "Событие обновления ссылается на отсутствующего студента или проект.",
      );
    }
  }

  for (const status of data.reviewStatusesFile.reviewStatuses) {
    const event = data.updateEventsFile.updateEvents.find(
      (item) => item.id === status.updateEventId,
    );

    if (event === undefined) {
      throw createStorageError(
        "storage_consistency_error",
        "Статус проверки ссылается на отсутствующее событие обновления.",
      );
    }

    if (
      event.studentId !== status.studentId ||
      event.projectId !== status.projectId
    ) {
      throw createStorageError(
        "storage_consistency_error",
        "Связь статуса проверки и события обновления нарушена.",
      );
    }
  }

  for (const comment of data.commentsFile.comments) {
    const event = data.updateEventsFile.updateEvents.find(
      (item) => item.id === comment.updateEventId,
    );

    if (event === undefined) {
      throw createStorageError(
        "storage_consistency_error",
        "Комментарий проверки ссылается на отсутствующее событие обновления.",
      );
    }

    if (
      event.studentId !== comment.studentId ||
      event.projectId !== comment.projectId
    ) {
      throw createStorageError(
        "storage_consistency_error",
        "Связь комментария проверки и события обновления нарушена.",
      );
    }
  }

  for (const report of data.aiReportsFile.aiReports) {
    const event = data.updateEventsFile.updateEvents.find(
      (item) => item.id === report.updateEventId,
    );

    if (event === undefined) {
      throw createStorageError(
        "storage_consistency_error",
        "ИИ-рапорт ссылается на отсутствующее событие обновления.",
      );
    }

    if (
      event.studentId !== report.studentId ||
      event.projectId !== report.projectId
    ) {
      throw createStorageError(
        "storage_consistency_error",
        "Связь ИИ-рапорта и события обновления нарушена.",
      );
    }
  }
}

let defaultStorage: AppStorage | null = null;

export function getDefaultStorage(): AppStorage {
  defaultStorage ??= new AppStorage();
  return defaultStorage;
}

export function resetDefaultStorageForTests(storage: AppStorage | null): void {
  defaultStorage = storage;
}
