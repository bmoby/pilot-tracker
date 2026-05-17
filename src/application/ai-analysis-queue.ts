import type { AiAnalysisJob, AppData, UpdateEvent } from "@/domain/schemas";
import { createPrefixedId } from "@/domain/ids";
import { createUtcTimestamp } from "@/domain/student-rules";
import type { CodexAnalysisClient } from "@/integrations/codex";
import type { PullRequestContextClient } from "@/integrations/github";
import {
  failure,
  normalizeUnknownError,
  success,
  type AppError,
  type AppResult,
} from "@/shared/result";
import { AppStorage, getDefaultStorage } from "@/storage/app-storage";
import { StorageError } from "@/storage/storage-error";
import {
  getAiAnalysisBlockedReason,
  runAiAnalysisForUpdate,
  type AiAnalysisGitClient,
} from "./ai-analysis";

const DEFAULT_CONCURRENCY = 2;
const ACTIVE_STATUSES = new Set<AiAnalysisJob["status"]>([
  "queued",
  "running",
]);
const INTERRUPTION_MESSAGE =
  "ИИ-анализ был прерван остановкой локального процесса приложения.";

export type EnqueueAiAnalysisJobInput = {
  updateEventId: string;
};

export type EnqueueAiAnalysisJobResponse = {
  jobId: string;
  studentId: string;
  projectId: string;
  updateEventId: string;
  alreadyQueued: boolean;
};

export type EnqueueAiAnalysisBatchResponse = {
  queued: number;
  alreadyQueued: number;
  skipped: number;
  jobIds: string[];
};

export type AiAnalysisQueueClients = {
  gitClient?: AiAnalysisGitClient;
  codexClient?: CodexAnalysisClient;
  pullRequestClient?: PullRequestContextClient;
};

type EnqueueAiAnalysisOptions = {
  startWorker?: boolean;
};

let workerPromise: Promise<void> | null = null;

export async function enqueueAiAnalysisJob(
  input: EnqueueAiAnalysisJobInput,
  storage = getDefaultStorage(),
  options: EnqueueAiAnalysisOptions = {},
): Promise<AppResult<EnqueueAiAnalysisJobResponse>> {
  try {
    const result = await storage.updateFiles(["aiAnalysisJobsFile"], (data) => {
      const event = findUpdateEvent(data, input.updateEventId);

      if (event === null) {
        return failure({
          code: "update_event_not_found",
          message: "Событие обновления не найдено.",
        });
      }

      const blocked = getAiAnalysisBlockedReason(data, event);

      if (blocked !== null) {
        return failure(blocked);
      }

      const existingJob = findActiveJob(data, event.id);

      if (existingJob !== null) {
        return success({
          jobId: existingJob.id,
          studentId: existingJob.studentId,
          projectId: existingJob.projectId,
          updateEventId: existingJob.updateEventId,
          alreadyQueued: true,
        });
      }

      const job = createQueuedJob(event);
      data.aiAnalysisJobsFile.aiAnalysisJobs.push(job);

      return success({
        jobId: job.id,
        studentId: job.studentId,
        projectId: job.projectId,
        updateEventId: job.updateEventId,
        alreadyQueued: false,
      });
    });

    if (result.ok && options.startWorker !== false) {
      startAiAnalysisQueueWorker(storage);
    }

    return result;
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function enqueueAiAnalysisJobsForLatestUpdates(
  storage = getDefaultStorage(),
  options: EnqueueAiAnalysisOptions = {},
): Promise<AppResult<EnqueueAiAnalysisBatchResponse>> {
  try {
    const result = await storage.updateFiles(["aiAnalysisJobsFile"], (data) => {
      const latestEvents = getLatestAnalyzableEvents(data);
      let queued = 0;
      let alreadyQueued = 0;
      let skipped = 0;
      const jobIds: string[] = [];

      for (const event of latestEvents) {
        if (getAiAnalysisBlockedReason(data, event) !== null) {
          skipped += 1;
          continue;
        }

        if (hasSuccessfulOrRunningReport(data, event.id)) {
          skipped += 1;
          continue;
        }

        const existingJob = findActiveJob(data, event.id);

        if (existingJob !== null) {
          alreadyQueued += 1;
          jobIds.push(existingJob.id);
          continue;
        }

        const job = createQueuedJob(event);
        data.aiAnalysisJobsFile.aiAnalysisJobs.push(job);
        queued += 1;
        jobIds.push(job.id);
      }

      return success({ queued, alreadyQueued, skipped, jobIds });
    });

    if (
      result.ok &&
      result.value.jobIds.length > 0 &&
      options.startWorker !== false
    ) {
      startAiAnalysisQueueWorker(storage);
    }

    return result;
  } catch (error) {
    return failure(toAppError(error));
  }
}

export function startAiAnalysisQueueWorker(
  storage = getDefaultStorage(),
  clients: AiAnalysisQueueClients = {},
  concurrency = DEFAULT_CONCURRENCY,
): void {
  if (workerPromise !== null) {
    return;
  }

  workerPromise = runAiAnalysisQueue(storage, clients, concurrency)
    .catch(() => undefined)
    .finally(() => {
      workerPromise = null;
    });
}

export async function runAiAnalysisQueueOnce(
  storage = getDefaultStorage(),
  clients: AiAnalysisQueueClients = {},
  concurrency = DEFAULT_CONCURRENCY,
): Promise<number> {
  const jobs = await claimQueuedJobs(storage, concurrency);
  await Promise.all(jobs.map((job) => runClaimedJob(job, storage, clients)));
  return jobs.length;
}

async function runAiAnalysisQueue(
  storage: AppStorage,
  clients: AiAnalysisQueueClients,
  concurrency: number,
): Promise<void> {
  await recoverInterruptedAiAnalysisJobs(storage);

  while (await runAiAnalysisQueueOnce(storage, clients, concurrency)) {
    // Цикл намеренно пустой: одна итерация забирает пачку заданий.
  }
}

async function claimQueuedJobs(
  storage: AppStorage,
  concurrency: number,
): Promise<AiAnalysisJob[]> {
  return storage.updateFiles(["aiAnalysisJobsFile"], (data) => {
    const now = createUtcTimestamp();
    const jobs = data.aiAnalysisJobsFile.aiAnalysisJobs
      .filter((job) => job.status === "queued")
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))
      .slice(0, Math.max(1, concurrency));

    for (const job of jobs) {
      job.status = "running";
      job.startedAt = now;
      job.finishedAt = null;
      job.attempts += 1;
      job.lastError = null;
      job.updatedAt = now;
    }

    return jobs.map((job) => ({ ...job }));
  });
}

async function runClaimedJob(
  job: AiAnalysisJob,
  storage: AppStorage,
  clients: AiAnalysisQueueClients,
): Promise<void> {
  const result = await runAiAnalysisForUpdate(
    {
      updateEventId: job.updateEventId,
      aiAnalysisJobId: job.id,
    },
    storage,
    clients.gitClient,
    clients.codexClient,
    clients.pullRequestClient,
  ).catch((error: unknown) => failure(toAppError(error)));

  await storage.updateFiles(["aiAnalysisJobsFile"], (data) => {
    const currentJob = data.aiAnalysisJobsFile.aiAnalysisJobs.find(
      (item) => item.id === job.id,
    );

    if (currentJob === undefined || currentJob.status === "interrupted") {
      return;
    }

    const now = createUtcTimestamp();
    currentJob.finishedAt = now;
    currentJob.updatedAt = now;

    if (!result.ok) {
      currentJob.status = "failed";
      currentJob.lastError = result.error.message;
      return;
    }

    currentJob.aiReportId = result.value.aiReportId;
    currentJob.status = result.value.status === "ready" ? "completed" : "failed";
    currentJob.lastError =
      result.value.status === "ready"
        ? null
        : "ИИ-анализ завершился ошибкой, причина сохранена в рапорте.";
  });
}

export async function recoverInterruptedAiAnalysisJobs(
  storage = getDefaultStorage(),
): Promise<void> {
  await storage.updateFiles(["aiAnalysisJobsFile", "aiReportsFile"], (data) => {
    const now = createUtcTimestamp();

    for (const job of data.aiAnalysisJobsFile.aiAnalysisJobs) {
      if (job.status !== "running") {
        continue;
      }

      job.status = "interrupted";
      job.finishedAt = now;
      job.lastError = INTERRUPTION_MESSAGE;
      job.updatedAt = now;

      if (job.aiReportId === null) {
        continue;
      }

      const report = data.aiReportsFile.aiReports.find(
        (item) => item.id === job.aiReportId,
      );

      if (report !== undefined && report.status === "running") {
        report.status = "error";
        report.finishedAt = now;
        report.error = INTERRUPTION_MESSAGE;
        report.updatedAt = now;
      }
    }
  });
}

function createQueuedJob(event: UpdateEvent): AiAnalysisJob {
  const now = createUtcTimestamp();

  return {
    id: createPrefixedId("ai_job"),
    studentId: event.studentId,
    projectId: event.projectId,
    updateEventId: event.id,
    aiReportId: null,
    status: "queued",
    attempts: 0,
    requestedAt: now,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

function getLatestAnalyzableEvents(data: AppData): UpdateEvent[] {
  return data.projectsFile.projects
    .map((project) =>
      project.lastUpdateEventId === null
        ? null
        : findUpdateEvent(data, project.lastUpdateEventId),
    )
    .filter((event): event is UpdateEvent => event !== null);
}

function findUpdateEvent(
  data: AppData,
  updateEventId: string,
): UpdateEvent | null {
  return (
    data.updateEventsFile.updateEvents.find(
      (event) => event.id === updateEventId,
    ) ?? null
  );
}

function findActiveJob(
  data: AppData,
  updateEventId: string,
): AiAnalysisJob | null {
  return (
    data.aiAnalysisJobsFile.aiAnalysisJobs.find(
      (job) =>
        job.updateEventId === updateEventId && ACTIVE_STATUSES.has(job.status),
    ) ?? null
  );
}

function hasSuccessfulOrRunningReport(
  data: AppData,
  updateEventId: string,
): boolean {
  return data.aiReportsFile.aiReports.some(
    (report) =>
      report.updateEventId === updateEventId &&
      (report.status === "ready" || report.status === "running"),
  );
}

function toAppError(error: unknown): AppError {
  if (error instanceof StorageError) {
    return error.appError;
  }

  return normalizeUnknownError(error);
}
