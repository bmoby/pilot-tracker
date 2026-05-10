import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GitProjectClient } from "@/integrations/git";
import { AppStorage } from "@/storage/app-storage";
import { createStudent, listStudents } from "./students";
import { updateAllProjects, updateSingleProject } from "./project-updates";

let tempRoot: string | null = null;

async function createStorage() {
  tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
  return new AppStorage({ projectRoot: tempRoot });
}

class FakeGitClient implements GitProjectClient {
  head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  originMain = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  newCommitsCount = 0;
  dirtyStatus = "";
  failedRepositoryPart: string | null = null;

  async cloneRepository(repositoryUrl: string, targetPath: string): Promise<void> {
    if (this.failedRepositoryPart !== null && repositoryUrl.includes(this.failedRepositoryPart)) {
      throw new Error("Репозиторий недоступен в тесте.");
    }

    await mkdir(targetPath, { recursive: true });
  }

  async readHead(): Promise<string> {
    return this.head;
  }

  async isRepository(): Promise<boolean> {
    return true;
  }

  async readStatus(): Promise<string> {
    return this.dirtyStatus;
  }

  async fetchMain(): Promise<void> {}

  async readOriginMain(): Promise<string> {
    return this.originMain;
  }

  async countCommits(): Promise<number> {
    return this.newCommitsCount;
  }

  async resetToOriginMain(): Promise<void> {
    this.head = this.originMain;
  }
}

describe("обновление проектов", () => {
  afterEach(async () => {
    if (tempRoot !== null) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("создает событие для студента без GitHub-ссылки", async () => {
    const storage = await createStorage();
    const git = new FakeGitClient();
    await createStudent({ displayName: "Анна" }, storage);

    const result = await updateAllProjects(storage, git);

    expect(result.ok).toBe(true);

    const data = await storage.load();
    expect(data.updateRunsFile.updateRuns).toHaveLength(1);
    expect(data.updateRunsFile.updateRuns[0]?.summary.studentsWithoutRepository).toBe(1);
    expect(data.updateEventsFile.updateEvents[0]?.result).toBe("skipped_no_repository");
    expect(data.reviewStatusesFile.reviewStatuses[0]?.status).toBe("not_reviewed");
    expect(data.projectsFile.projects[0]?.status).toBe("not_connected");
  });

  it("сохраняет первую загрузку проекта", async () => {
    const storage = await createStorage();
    const git = new FakeGitClient();
    await createStudent(
      {
        displayName: "Мария",
        repositoryUrl: "https://github.com/course/maria",
      },
      storage,
    );

    const result = await updateAllProjects(storage, git);

    expect(result.ok).toBe(true);

    const data = await storage.load();
    const project = data.projectsFile.projects[0];
    const event = data.updateEventsFile.updateEvents[0];

    expect(project?.status).toBe("first_loaded");
    expect(project?.localPath).toMatch(/^repositories\/student_/);
    expect(project?.lastKnownCommit).toBe(git.head);
    expect(event?.result).toBe("cloned");
    expect(event?.newCommit).toBe(git.head);
    expect(event?.newCommitsCount).toBeNull();
  });

  it("сохраняет повторное обновление с новыми коммитами", async () => {
    const storage = await createStorage();
    const git = new FakeGitClient();
    await createStudent(
      {
        displayName: "Олег",
        repositoryUrl: "https://github.com/course/oleg",
      },
      storage,
    );
    await updateAllProjects(storage, git);

    git.originMain = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    git.newCommitsCount = 2;

    const result = await updateAllProjects(storage, git);

    expect(result.ok).toBe(true);

    const data = await storage.load();
    const latestEvent = data.updateEventsFile.updateEvents.at(-1);

    expect(data.projectsFile.projects[0]?.status).toBe("has_changes");
    expect(data.projectsFile.projects[0]?.lastKnownCommit).toBe(git.originMain);
    expect(latestEvent?.result).toBe("updated_with_changes");
    expect(latestEvent?.previousCommit).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(latestEvent?.newCommit).toBe(git.originMain);
    expect(latestEvent?.newCommitsCount).toBe(2);
  });

  it("не останавливает общий запуск из-за ошибки одного проекта", async () => {
    const storage = await createStorage();
    const git = new FakeGitClient();
    git.failedRepositoryPart = "broken";
    await createStudent(
      {
        displayName: "Первый",
        repositoryUrl: "https://github.com/course/broken",
      },
      storage,
    );
    await createStudent(
      {
        displayName: "Второй",
        repositoryUrl: "https://github.com/course/working",
      },
      storage,
    );

    const result = await updateAllProjects(storage, git);

    expect(result.ok).toBe(true);

    const data = await storage.load();
    expect(data.updateRunsFile.updateRuns[0]?.summary.errorsTotal).toBe(1);
    expect(data.updateRunsFile.updateRuns[0]?.summary.projectsFirstLoaded).toBe(1);
    expect(data.updateEventsFile.updateEvents.map((event) => event.result)).toEqual([
      "error",
      "cloned",
    ]);
  });

  it("отклоняет одиночное обновление, если проект не подключен", async () => {
    const storage = await createStorage();
    await createStudent({ displayName: "Лена" }, storage);
    const list = await listStudents(storage);

    if (!list.ok) {
      throw new Error("Список должен загрузиться.");
    }

    const result = await updateSingleProject(list.value.students[0]?.studentId ?? "", storage);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("repository_not_connected");
    }
  });
});
