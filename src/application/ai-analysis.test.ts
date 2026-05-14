import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiPullRequestContext } from "@/domain/schemas";
import {
  CodexCommandError,
  type CodexAnalysisClient,
  type CodexAnalysisInput,
} from "@/integrations/codex";
import type { GitProjectClient } from "@/integrations/git";
import type {
  PullRequestContextClient,
  PullRequestContextInput,
} from "@/integrations/github";
import { AppStorage } from "@/storage/app-storage";
import { updateAllProjects } from "./project-updates";
import {
  runAiAnalysisForUpdate,
  type AiAnalysisGitClient,
} from "./ai-analysis";
import { createStudent } from "./students";

let tempRoot: string | null = null;

async function createStorage() {
  tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
  return new AppStorage({ projectRoot: tempRoot });
}

class FakeUpdateGitClient implements GitProjectClient {
  head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  async cloneRepository(
    _repositoryUrl: string,
    targetPath: string,
  ): Promise<void> {
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

class FakeAiGitClient implements AiAnalysisGitClient {
  readonly availableCommits = new Set<string>();
  readonly heads = new Map<string, string>();
  readonly statuses = new Map<string, string>();
  createdWorktrees: string[] = [];

  async readHead(repositoryPath: string): Promise<string> {
    return (
      this.heads.get(repositoryPath) ??
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
  }

  async readStatus(repositoryPath: string): Promise<string> {
    return this.statuses.get(repositoryPath) ?? "";
  }

  async isRepository(): Promise<boolean> {
    return true;
  }

  async readCurrentBranch(): Promise<string> {
    return "main";
  }

  async verifyCommit(_repositoryPath: string, commit: string): Promise<void> {
    if (!this.availableCommits.has(commit)) {
      throw new Error("Коммит отсутствует.");
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

  async removeWorktree(
    _repositoryPath: string,
    reviewPath: string,
  ): Promise<void> {
    await rm(reviewPath, { recursive: true, force: true });
    this.heads.delete(reviewPath);
    this.statuses.delete(reviewPath);
  }

  async readCommitLog(): Promise<string> {
    return "aaaaaaaa первая версия проекта";
  }

  async readDiff(): Promise<string> {
    return "diff --git a/app.ts b/app.ts";
  }

  async listTrackedFiles(): Promise<string> {
    return "README.md\nsrc/app.ts\npackage.json\n";
  }
}

class FakeCodexClient implements CodexAnalysisClient {
  calls: CodexAnalysisInput[] = [];
  shouldFail = false;

  async runAnalysis(
    input: CodexAnalysisInput,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.calls.push(input);

    if (this.shouldFail) {
      throw new CodexCommandError({
        command: "codex",
        args: ["exec"],
        cwd: input.workingDirectory,
        stdout: "",
        stderr: "Ошибка тестового Codex.",
        exitCode: 1,
        message: "Codex завершился с ошибкой.",
      });
    }

    await writeFile(
      input.outputPath,
      JSON.stringify({
        summary: "Проект загружен и требует первой проверки.",
        importantFiles: ["src/app.ts"],
        changes: "Видна базовая структура приложения.",
        risks: ["Нет тестов."],
        manualReviewQuestions: ["Запускается ли приложение локально?"],
        teacherCommentDraft: "Хорошее начало, проверь запуск и добавь тесты.",
        fullText: "Полный тестовый ИИ-рапорт.",
        projectDescription: {
          summary: "Учебное приложение.",
          idea: "Тренировочный проект студента.",
          keyParts: ["src/app.ts"],
        },
      }),
      "utf8",
    );

    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
    };
  }
}

class FakePullRequestClient implements PullRequestContextClient {
  async findPullRequestContext(
    _input: PullRequestContextInput,
  ): Promise<AiPullRequestContext> {
    return {
      status: "found",
      number: 12,
      title: "Учебное обновление",
      url: "https://github.com/course/anna/pull/12",
      state: "OPEN",
      error: null,
    };
  }
}

describe("ручной ИИ-анализ обновления", () => {
  afterEach(async () => {
    if (tempRoot !== null) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("создает review-копию, запускает Codex и сохраняет готовый ИИ-рапорт", async () => {
    const storage = await createStorage();
    const { eventId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeAiGitClient();
    const codex = new FakeCodexClient();
    git.availableCommits.add(newCommit);

    const result = await runAiAnalysisForUpdate(
      { updateEventId: eventId },
      storage,
      git,
      codex,
      new FakePullRequestClient(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("ИИ-анализ должен быть успешным.");
    }

    const data = await storage.load();
    const report = data.aiReportsFile.aiReports[0];

    expect(report?.status).toBe("ready");
    expect(report?.analysisMode).toBe("current_state");
    expect(report?.summary).toBe("Проект загружен и требует первой проверки.");
    expect(report?.pullRequestContext.number).toBe(12);
    expect(data.projectsFile.projects[0]?.aiDescription.summary).toBe(
      "Учебное приложение.",
    );
    expect(codex.calls[0]?.prompt).toContain("Выводы ИИ являются подсказкой");
    expect(git.createdWorktrees).toHaveLength(1);
  });

  it("не создает ИИ-рапорт, если Codex CLI заранее отмечен как недоступный", async () => {
    const storage = await createStorage();
    const { eventId, newCommit } = await createSuccessfulUpdate(storage);
    const data = await storage.load();
    data.settingsFile.settings.tools.codex.status = "error";
    data.settingsFile.settings.tools.codex.message = "Codex CLI недоступен.";
    await storage.saveFiles(data, ["settingsFile"]);
    const git = new FakeAiGitClient();
    const codex = new FakeCodexClient();
    git.availableCommits.add(newCommit);

    const result = await runAiAnalysisForUpdate(
      { updateEventId: eventId },
      storage,
      git,
      codex,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("codex_unavailable");
    }

    const updatedData = await storage.load();
    expect(updatedData.aiReportsFile.aiReports).toEqual([]);
    expect(codex.calls).toEqual([]);
  });

  it("сохраняет ошибочный ИИ-рапорт, если Codex завершился ошибкой после начала запуска", async () => {
    const storage = await createStorage();
    const { eventId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeAiGitClient();
    const codex = new FakeCodexClient();
    git.availableCommits.add(newCommit);
    codex.shouldFail = true;

    const result = await runAiAnalysisForUpdate(
      { updateEventId: eventId },
      storage,
      git,
      codex,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(
        "Начатый запуск должен завершиться сохраненным рапортом.",
      );
    }
    expect(result.value.status).toBe("error");

    const data = await storage.load();
    const report = data.aiReportsFile.aiReports[0];

    expect(report?.status).toBe("error");
    expect(report?.error).toBe("Codex CLI завершил ИИ-анализ с ошибкой.");
    expect(report?.technicalDetails).toContain("Ошибка тестового Codex.");
  });

  it("повторный запуск добавляет новый ИИ-рапорт и не перезаписывает старый", async () => {
    const storage = await createStorage();
    const { eventId, newCommit } = await createSuccessfulUpdate(storage);
    const git = new FakeAiGitClient();
    git.availableCommits.add(newCommit);

    await runAiAnalysisForUpdate(
      { updateEventId: eventId },
      storage,
      git,
      new FakeCodexClient(),
    );
    await runAiAnalysisForUpdate(
      { updateEventId: eventId },
      storage,
      git,
      new FakeCodexClient(),
    );

    const data = await storage.load();

    expect(data.aiReportsFile.aiReports).toHaveLength(2);
    expect(
      new Set(data.aiReportsFile.aiReports.map((report) => report.id)).size,
    ).toBe(2);
  });
});

async function createSuccessfulUpdate(storage: AppStorage): Promise<{
  eventId: string;
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
    newCommit: event.newCommit,
  };
}
