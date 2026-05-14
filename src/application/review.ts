import {
  aiReportIdSchema,
  type Comment,
  type ReviewStatus,
  type ReviewStatusValue,
  reviewStatusValueSchema,
  type UpdateEvent,
} from "@/domain/schemas";
import { createPrefixedId } from "@/domain/ids";
import { createUtcTimestamp } from "@/domain/student-rules";
import { failure, normalizeUnknownError, success, type AppError, type AppResult } from "@/shared/result";
import { getDefaultStorage } from "@/storage/app-storage";
import { StorageError } from "@/storage/storage-error";

export type ReviewMutationResponse = {
  studentId: string;
  projectId: string;
  updateEventId: string;
};

export type AddReviewCommentInput = {
  updateEventId: string;
  text: string;
  basedOnAiReportId?: string | null;
};

export type UpdateReviewCommentInput = {
  commentId: string;
  text: string;
};

export type DeleteReviewCommentInput = {
  commentId: string;
  confirmed: boolean;
};

export type UpdateReviewStatusInput = {
  updateEventId: string;
  status: string;
};

export async function addReviewComment(
  input: AddReviewCommentInput,
  storage = getDefaultStorage(),
): Promise<AppResult<ReviewMutationResponse>> {
  try {
    const text = normalizeCommentText(input.text);

    if (text === null) {
      return failure({
        code: "comment_validation_error",
        message: "Комментарий не может быть пустым.",
      });
    }

    const basedOnAiReportId = normalizeAiReportId(input.basedOnAiReportId ?? null);

    if (!basedOnAiReportId.ok) {
      return failure(basedOnAiReportId.error);
    }

    const data = await storage.load();
    const event = findUpdateEvent(data.updateEventsFile.updateEvents, input.updateEventId);

    if (event === null) {
      return failure({
        code: "update_event_not_found",
        message: "Событие обновления не найдено.",
      });
    }

    const now = createUtcTimestamp();
    const comment: Comment = {
      id: createPrefixedId("comment"),
      studentId: event.studentId,
      projectId: event.projectId,
      updateEventId: event.id,
      text,
      basedOnAiReportId: basedOnAiReportId.value,
      createdAt: now,
      updatedAt: now,
    };

    data.commentsFile.comments.push(comment);
    await storage.saveFiles(data, ["commentsFile"]);

    return success(toReviewMutationResponse(event));
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function updateReviewComment(
  input: UpdateReviewCommentInput,
  storage = getDefaultStorage(),
): Promise<AppResult<ReviewMutationResponse>> {
  try {
    const text = normalizeCommentText(input.text);

    if (text === null) {
      return failure({
        code: "comment_validation_error",
        message: "Комментарий не может быть пустым.",
      });
    }

    const data = await storage.load();
    const comment = data.commentsFile.comments.find((item) => item.id === input.commentId) ?? null;

    if (comment === null) {
      return failure({
        code: "comment_not_found",
        message: "Комментарий не найден.",
      });
    }

    const event = findUpdateEvent(data.updateEventsFile.updateEvents, comment.updateEventId);

    if (event === null) {
      return failure({
        code: "update_event_not_found",
        message: "Событие обновления не найдено.",
      });
    }

    comment.text = text;
    comment.updatedAt = createUtcTimestamp();
    await storage.saveFiles(data, ["commentsFile"]);

    return success(toReviewMutationResponse(event));
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function deleteReviewComment(
  input: DeleteReviewCommentInput,
  storage = getDefaultStorage(),
): Promise<AppResult<ReviewMutationResponse>> {
  try {
    if (!input.confirmed) {
      return failure({
        code: "delete_confirmation_required",
        message: "Удаление комментария требует подтверждения.",
      });
    }

    const data = await storage.load();
    const comment = data.commentsFile.comments.find((item) => item.id === input.commentId) ?? null;

    if (comment === null) {
      return failure({
        code: "comment_not_found",
        message: "Комментарий не найден.",
      });
    }

    const event = findUpdateEvent(data.updateEventsFile.updateEvents, comment.updateEventId);

    if (event === null) {
      return failure({
        code: "update_event_not_found",
        message: "Событие обновления не найдено.",
      });
    }

    data.commentsFile.comments = data.commentsFile.comments.filter(
      (item) => item.id !== input.commentId,
    );
    await storage.saveFiles(data, ["commentsFile"]);

    return success(toReviewMutationResponse(event));
  } catch (error) {
    return failure(toAppError(error));
  }
}

export async function updateReviewStatus(
  input: UpdateReviewStatusInput,
  storage = getDefaultStorage(),
): Promise<AppResult<ReviewMutationResponse>> {
  try {
    const status = reviewStatusValueSchema.safeParse(input.status);

    if (!status.success) {
      return failure({
        code: "review_status_validation_error",
        message: "Статус проверки не найден.",
      });
    }

    const data = await storage.load();
    const event = findUpdateEvent(data.updateEventsFile.updateEvents, input.updateEventId);

    if (event === null) {
      return failure({
        code: "update_event_not_found",
        message: "Событие обновления не найдено.",
      });
    }

    const now = createUtcTimestamp();
    const reviewStatus = findReviewStatusByEventId(data.reviewStatusesFile.reviewStatuses, event.id);

    if (reviewStatus === null) {
      data.reviewStatusesFile.reviewStatuses.push(createReviewStatus(event, status.data, now));
    } else {
      reviewStatus.status = status.data;
      reviewStatus.updatedAt = now;
    }

    await storage.saveFiles(data, ["reviewStatusesFile"]);

    return success(toReviewMutationResponse(event));
  } catch (error) {
    return failure(toAppError(error));
  }
}

function normalizeCommentText(value: string): string | null {
  const text = value.trim();
  return text.length === 0 ? null : text;
}

function normalizeAiReportId(value: string | null): AppResult<string | null> {
  if (value === null || value.trim().length === 0) {
    return success(null);
  }

  const parsed = aiReportIdSchema.safeParse(value.trim());

  if (!parsed.success) {
    return failure({
      code: "ai_report_validation_error",
      message: "ИИ-рапорт для комментария не найден.",
    });
  }

  return success(parsed.data);
}

function findUpdateEvent(events: UpdateEvent[], updateEventId: string): UpdateEvent | null {
  return events.find((event) => event.id === updateEventId) ?? null;
}

function findReviewStatusByEventId(
  statuses: ReviewStatus[],
  updateEventId: string,
): ReviewStatus | null {
  return statuses.find((status) => status.updateEventId === updateEventId) ?? null;
}

function createReviewStatus(
  event: UpdateEvent,
  status: ReviewStatusValue,
  now: string,
): ReviewStatus {
  return {
    id: createPrefixedId("review_status"),
    studentId: event.studentId,
    projectId: event.projectId,
    updateEventId: event.id,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

function toReviewMutationResponse(event: UpdateEvent): ReviewMutationResponse {
  return {
    studentId: event.studentId,
    projectId: event.projectId,
    updateEventId: event.id,
  };
}

function toAppError(error: unknown): AppError {
  if (error instanceof StorageError) {
    return error.appError;
  }

  return normalizeUnknownError(error);
}
