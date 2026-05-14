import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  runEnvironmentDiagnostics,
  type DiagnosticCommandResult,
  type DiagnosticCommandRunner,
} from "./environment-diagnostics";
import { AppStorage } from "@/storage/app-storage";

let tempRoot: string | null = null;

describe("диагностика локального окружения", () => {
  afterEach(async () => {
    if (tempRoot !== null) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("сохраняет успешные статусы путей и локальных инструментов", async () => {
    const storage = await createStorage();
    const runner = createRunner({
      "git --version": successfulCommand("git version 2.40.0\n"),
      "gh --version": successfulCommand("gh version 2.50.0\n"),
      "gh auth status": successfulCommand("Logged in\n"),
      "codex --version": successfulCommand("codex 1.0.0\n"),
      "code --version": successfulCommand("1.120.0\n"),
    });

    const result = await runEnvironmentDiagnostics({
      storage,
      runner,
      now: () => new Date("2026-05-14T08:00:00.000Z"),
    });

    expect(result.ok).toBe(true);

    const data = await storage.load();

    expect(data.settingsFile.settings.paths?.dataRoot.status).toBe("success");
    expect(data.settingsFile.settings.paths?.settingsFile.status).toBe(
      "success",
    );
    expect(data.settingsFile.settings.tools.git.status).toBe("success");
    expect(data.settingsFile.settings.tools.git.version).toBe(
      "git version 2.40.0",
    );
    expect(data.settingsFile.settings.tools.gh.status).toBe("success");
    expect(data.settingsFile.settings.tools.gh.authStatus).toBe(
      "authenticated",
    );
    expect(data.settingsFile.settings.tools.codex.status).toBe("success");
    expect(data.settingsFile.settings.tools.code.checkedAt).toBe(
      "2026-05-14T08:00:00.000Z",
    );
  });

  it("сохраняет предупреждение, если GitHub CLI доступен без подтвержденной авторизации", async () => {
    const storage = await createStorage();
    const runner = createRunner({
      "git --version": successfulCommand("git version 2.40.0\n"),
      "gh --version": successfulCommand("gh version 2.50.0\n"),
      "gh auth status": failedCommand(
        "You are not logged into any GitHub hosts\n",
      ),
      "codex --version": successfulCommand("codex 1.0.0\n"),
      "code --version": successfulCommand("1.120.0\n"),
    });

    const result = await runEnvironmentDiagnostics({
      storage,
      runner,
      now: () => new Date("2026-05-14T08:10:00.000Z"),
    });

    expect(result.ok).toBe(true);

    const data = await storage.load();
    const gh = data.settingsFile.settings.tools.gh;

    expect(gh.status).toBe("warning");
    expect(gh.authStatus).toBe("unauthenticated");
    expect(gh.message).toBe(
      "GitHub CLI доступен, но локальная авторизация не подтверждена.",
    );
    expect(gh.details).toContain("Код выхода: 1.");
    expect(data.settingsFile.settings.tools.codex.status).toBe("success");
  });

  it("сохраняет ошибку, если Codex CLI недоступен", async () => {
    const storage = await createStorage();
    const runner = createRunner({
      "git --version": successfulCommand("git version 2.40.0\n"),
      "gh --version": successfulCommand("gh version 2.50.0\n"),
      "gh auth status": successfulCommand("Logged in\n"),
      "codex --version": missingCommand("spawn codex ENOENT"),
      "code --version": successfulCommand("1.120.0\n"),
    });

    const result = await runEnvironmentDiagnostics({
      storage,
      runner,
      now: () => new Date("2026-05-14T08:20:00.000Z"),
    });

    expect(result.ok).toBe(true);

    const data = await storage.load();
    const codex = data.settingsFile.settings.tools.codex;

    expect(codex.status).toBe("error");
    expect(codex.message).toBe(
      "Codex CLI недоступен. ИИ-анализ нельзя будет запустить до исправления.",
    );
    expect(codex.details).toContain("spawn codex ENOENT");
    expect(data.settingsFile.settings.tools.gh.status).toBe("success");
  });
});

async function createStorage(): Promise<AppStorage> {
  tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
  const storage = new AppStorage({ projectRoot: tempRoot });
  await storage.load();
  return storage;
}

function createRunner(
  results: Record<string, DiagnosticCommandResult>,
): DiagnosticCommandRunner {
  return async (command, args) => {
    const key = [command, ...args].join(" ");
    const result = results[key];

    if (result === undefined) {
      throw new Error(`Неожиданная команда диагностики: ${key}`);
    }

    return result;
  };
}

function successfulCommand(stdout: string): DiagnosticCommandResult {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
    error: null,
    timedOut: false,
  };
}

function failedCommand(stderr: string): DiagnosticCommandResult {
  return {
    exitCode: 1,
    stdout: "",
    stderr,
    error: null,
    timedOut: false,
  };
}

function missingCommand(error: string): DiagnosticCommandResult {
  return {
    exitCode: null,
    stdout: "",
    stderr: "",
    error,
    timedOut: false,
  };
}
