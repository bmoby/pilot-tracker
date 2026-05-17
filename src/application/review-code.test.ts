import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GitProjectClient, GitReviewCopyClient } from "@/integrations/git";
import type { CodeOpenClient } from "@/integrations/vscode";
import { VsCodeCommandError } from "@/integrations/vscode";
import { AppStorage } from "@/storage/app-storage";
import { updateAllProjects } from "./project-updates";
import { openUpdateCodeInVsCode } from "./review-code";
import { createStudent } from "./students";

let tempRoot: string | null = null;

async function createStorage() {
  tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
  return new AppStorage({ projectRoot: tempRoot });
}

class FakeUpdateGitClient implements GitProjectClient {
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

class FakeReviewGitClient implements GitReviewCopyClient {
  readonly availableCommits = new Set<string>();
  readonly heads = new Map<string, string>();
  readonly statuses = new Map<string, string>();
  readonly createdWorktrees: string[] = [];
  readonly removedWorktrees: string[] = [];
  readonly restoredWorktrees: Array<{ reviewPath: string; commit: string }> = [];
  currentBranch = "main";

  async readHead(repositoryPath: string): Promise<string> {
    return this.heads.get(repositoryPath) ?? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  }

  async readStatus(repositoryPath: string): Promise<string> {
    return this.statuses.get(repositoryPath) ?? "";
  }

  async isRepository(): Promise<boolean> {
    return true;
  }

  async readCurrentBranch(): Promise<string> {
    return this.currentBranch;
  }

  async verifyCommit(_repositoryPath: string, commit: string): Promise<void> {
    if (!this.availableCommits.has(commit)) {
      throw new Error("Коммит отсутствует в тестовой локальной копии.");
    }
  }

  async createDetachedWorktree(
    _repositoryPath: string,
    reviewPath: string,
    commit: string,
  ): Promise<void> {
    await mkdir(reviewPath, { recursive: true });
    this.createdWorktrees.push(reviewPath);
    this.heads.set(reviewPath, commit);
    this.statuses.set(reviewPath, "");
  }

  async removeWorktree(_repositoryPath: string, reviewPath: string): Promise<void> {
    this.removedWorktrees.push(reviewPath);
    this.heads.delete(reviewPath);
    this.statuses.delete(reviewPath);
    await rm(reviewPath, { recursive: true, force: true });
  }

  async restoreWorktreeToCommit(reviewPath: string, commit: string): Promise<void> {
    this.restoredWorktrees.push({ reviewPath, commit });
    this.heads.set(reviewPath, commit);
    this.statuses.set(reviewPath, "");
  }
}

class FakeCodeOpenClient implements CodeOpenClient {
  openedPaths: string[] = [];
  failAsMissing = false;

  async openPath(path: string): Promise<void> {
    if (this.failAsMissing) {
      throw new VsCodeCommandError({
        command: "code",
        args: [path],
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Команда не найдена.",
      });
    }

    this.openedPaths.push(path);
  }
}

describe("открытие кода обновления в VS Code", () => {
  afterEach(async () => {
    if (tempRoot !== null) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("создает review-копию и открывает ее в VS Code", async () => {
    const storage = await createStorage();
    const { eventId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeReviewGitClient();
    const code = new FakeCodeOpenClient();
    git.availableCommits.add(newCommit);

    const result = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Открытие кода должно быть успешным.");
    }

    expect(git.createdWorktrees).toEqual([result.value.reviewCopyPath]);
    expect(code.openedPaths).toEqual([result.value.reviewCopyPath]);

    const data = await storage.load();
    expect(data.reviewStatusesFile.reviewStatuses[0]?.status).toBe("not_reviewed");
    expect(data.updateEventsFile.updateEvents).toHaveLength(1);
  });

  it("повторно использует чистую review-копию с нужным коммитом", async () => {
    const storage = await createStorage();
    const { eventId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeReviewGitClient();
    const code = new FakeCodeOpenClient();
    git.availableCommits.add(newCommit);

    const first = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);
    const second = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(git.createdWorktrees).toHaveLength(1);
    expect(code.openedPaths).toHaveLength(2);
  });

  it("не открывает обновление без известного коммита", async () => {
    const storage = await createStorage();
    await createStudent({ displayName: "Анна" }, storage);
    const update = await updateAllProjects(storage, new FakeUpdateGitClient());
    expect(update.ok).toBe(true);
    const data = await storage.load();
    const eventId = data.updateEventsFile.updateEvents[0]?.id ?? "";
    const git = new FakeReviewGitClient();
    const code = new FakeCodeOpenClient();

    const result = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("update_commit_missing");
    }
    expect(code.openedPaths).toEqual([]);
  });

  it("не создает review-копию, если коммит отсутствует локально", async () => {
    const storage = await createStorage();
    const { eventId } = await createSuccessfulUpdate(storage);
    const git = new FakeReviewGitClient();
    const code = new FakeCodeOpenClient();

    const result = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("commit_not_available");
    }
    expect(git.createdWorktrees).toEqual([]);
    expect(code.openedPaths).toEqual([]);
  });

  it("восстанавливает грязную review-копию перед открытием", async () => {
    const storage = await createStorage();
    const { eventId, studentId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeReviewGitClient();
    const code = new FakeCodeOpenClient();
    git.availableCommits.add(newCommit);
    const reviewPath = join(storage.reviewCopiesPath, studentId, eventId);
    await mkdir(reviewPath, { recursive: true });
    git.heads.set(reviewPath, newCommit);
    git.statuses.set(reviewPath, " M src/app.ts");

    const result = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);

    expect(result.ok).toBe(true);
    expect(git.restoredWorktrees).toEqual([{ reviewPath, commit: newCommit }]);
    expect(git.createdWorktrees).toEqual([]);
    expect(code.openedPaths).toEqual([reviewPath]);
  });

  it("пересоздает чистую review-копию с другим коммитом", async () => {
    const storage = await createStorage();
    const { eventId, studentId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeReviewGitClient();
    const code = new FakeCodeOpenClient();
    git.availableCommits.add(newCommit);
    const reviewPath = join(storage.reviewCopiesPath, studentId, eventId);
    await mkdir(reviewPath, { recursive: true });
    git.heads.set(reviewPath, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    git.statuses.set(reviewPath, "");

    const result = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);

    expect(result.ok).toBe(true);
    expect(git.removedWorktrees).toEqual([reviewPath]);
    expect(git.createdWorktrees).toEqual([reviewPath]);
    expect(code.openedPaths).toEqual([reviewPath]);
  });

  it("сохраняет review-копию при недоступном VS Code и возвращает путь", async () => {
    const storage = await createStorage();
    const { eventId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeReviewGitClient();
    const code = new FakeCodeOpenClient();
    git.availableCommits.add(newCommit);
    code.failAsMissing = true;

    const result = await openUpdateCodeInVsCode({ updateEventId: eventId }, storage, git, code);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("vscode_not_available");
      expect(result.error.path).toContain("review-copies");
    }
    expect(git.createdWorktrees).toHaveLength(1);
  });
});

async function createSuccessfulUpdate(storage: AppStorage): Promise<{
  eventId: string;
  studentId: string;
  newCommit: string;
}> {
  const studentResult = await createStudent(
    {
      displayName: "Анна",
      repositoryUrl: "https://github.com/course/anna",
    },
    storage,
  );

  expect(studentResult.ok).toBe(true);

  const updateGit = new FakeUpdateGitClient();
  const updateResult = await updateAllProjects(storage, updateGit);

  expect(updateResult.ok).toBe(true);

  const data = await storage.load();
  const event = data.updateEventsFile.updateEvents[0];

  if (event === undefined || event.newCommit === null) {
    throw new Error("Успешное обновление должно сохранить новый коммит.");
  }

  return {
    eventId: event.id,
    studentId: event.studentId,
    newCommit: event.newCommit,
  };
}
