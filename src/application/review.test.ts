import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GitProjectClient } from "@/integrations/git";
import { AppStorage } from "@/storage/app-storage";
import { getStudentDetails, updateAllProjects } from "./project-updates";
import {
  addReviewComment,
  deleteReviewComment,
  updateReviewComment,
  updateReviewStatus,
} from "./review";
import { createStudent } from "./students";

let tempRoot: string | null = null;

async function createStorage() {
  tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
  return new AppStorage({ projectRoot: tempRoot });
}

class FakeGitClient implements GitProjectClient {
  head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  async cloneRepository(_repositoryUrl: string, targetPath: string): Promise<void> {
    await mkdir(targetPath, { recursive: true });
  }

  async readHead(): Promise<string> {
    return this.head;
  }

  async isRepository(): Promise<boolean> {
    return true;
  }

  async readStatus(): Promise<string> {
    return "";
  }

  async fetchMain(): Promise<void> {}

  async readOriginMain(): Promise<string> {
    return this.head;
  }

  async countCommits(): Promise<number> {
    return 0;
  }

  async resetToOriginMain(): Promise<void> {}
}

describe("комментарии проверки и статусы обновлений", () => {
  afterEach(async () => {
    if (tempRoot !== null) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("сохраняет комментарий к событию обновления и возвращает его в карточке студента", async () => {
    const storage = await createStorage();
    const { eventId, studentId } = await createUpdateEvent(storage);

    const result = await addReviewComment(
      {
        updateEventId: eventId,
        text: "Проверить обработку пустого состояния.",
      },
      storage,
    );

    expect(result.ok).toBe(true);

    const data = await getStudentDetails(studentId, storage);

    expect(data.ok).toBe(true);
    if (!data.ok) {
      throw new Error("Карточка студента должна загрузиться.");
    }

    expect(data.value.events[0]?.commentsCount).toBe(1);
    expect(data.value.events[0]?.comments[0]?.text).toBe("Проверить обработку пустого состояния.");
  });

  it("не сохраняет пустой комментарий", async () => {
    const storage = await createStorage();
    const { eventId } = await createUpdateEvent(storage);

    const result = await addReviewComment({ updateEventId: eventId, text: "   " }, storage);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("comment_validation_error");
    }

    const data = await storage.load();
    expect(data.commentsFile.comments).toHaveLength(0);
  });

  it("редактирует существующий комментарий", async () => {
    const storage = await createStorage();
    const { eventId } = await createUpdateEvent(storage);
    await addReviewComment({ updateEventId: eventId, text: "Первичная заметка." }, storage);
    const dataBefore = await storage.load();
    const commentId = dataBefore.commentsFile.comments[0]?.id ?? "";

    const result = await updateReviewComment(
      {
        commentId,
        text: "Обновленная заметка.",
      },
      storage,
    );

    expect(result.ok).toBe(true);

    const dataAfter = await storage.load();
    expect(dataAfter.commentsFile.comments[0]?.text).toBe("Обновленная заметка.");
  });

  it("удаляет комментарий после подтверждения", async () => {
    const storage = await createStorage();
    const { eventId, studentId } = await createUpdateEvent(storage);
    await addReviewComment({ updateEventId: eventId, text: "Временная заметка." }, storage);
    const dataBefore = await storage.load();
    const commentId = dataBefore.commentsFile.comments[0]?.id ?? "";

    const result = await deleteReviewComment({ commentId, confirmed: true }, storage);

    expect(result.ok).toBe(true);

    const data = await getStudentDetails(studentId, storage);

    expect(data.ok).toBe(true);
    if (!data.ok) {
      throw new Error("Карточка студента должна загрузиться.");
    }

    expect(data.value.events[0]?.commentsCount).toBe(0);
    expect(data.value.events[0]?.comments).toHaveLength(0);
  });

  it("не удаляет комментарий без подтверждения", async () => {
    const storage = await createStorage();
    const { eventId } = await createUpdateEvent(storage);
    await addReviewComment({ updateEventId: eventId, text: "Нужная заметка." }, storage);
    const dataBefore = await storage.load();
    const commentId = dataBefore.commentsFile.comments[0]?.id ?? "";

    const result = await deleteReviewComment({ commentId, confirmed: false }, storage);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("delete_confirmation_required");
    }

    const dataAfter = await storage.load();
    expect(dataAfter.commentsFile.comments).toHaveLength(1);
    expect(dataAfter.commentsFile.comments[0]?.text).toBe("Нужная заметка.");
  });

  it("меняет ручной статус проверки события", async () => {
    const storage = await createStorage();
    const { eventId, studentId } = await createUpdateEvent(storage);

    const result = await updateReviewStatus(
      {
        updateEventId: eventId,
        status: "needs_work",
      },
      storage,
    );

    expect(result.ok).toBe(true);

    const data = await getStudentDetails(studentId, storage);

    expect(data.ok).toBe(true);
    if (!data.ok) {
      throw new Error("Карточка студента должна загрузиться.");
    }

    expect(data.value.events[0]?.reviewStatus).toBe("needs_work");
    expect(data.value.events[0]?.reviewStatusLabel).toBe("требует доработки");
  });
});

async function createUpdateEvent(storage: AppStorage): Promise<{
  eventId: string;
  studentId: string;
}> {
  const studentResult = await createStudent(
    {
      displayName: "Анна",
      repositoryUrl: "https://github.com/course/anna",
    },
    storage,
  );

  expect(studentResult.ok).toBe(true);

  const updateResult = await updateAllProjects(storage, new FakeGitClient());

  expect(updateResult.ok).toBe(true);

  const data = await storage.load();
  const event = data.updateEventsFile.updateEvents[0];

  if (event === undefined) {
    throw new Error("Событие обновления должно быть создано.");
  }

  return {
    eventId: event.id,
    studentId: event.studentId,
  };
}
