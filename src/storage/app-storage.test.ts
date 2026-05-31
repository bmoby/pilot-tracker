import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { AppStorage } from "./app-storage";
import { pathExists } from "./file-system";

let tempRoot: string | null = null;

describe("локальное хранилище", () => {
  afterEach(async () => {
    if (tempRoot !== null) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("создает структуру data и начальные JSON-файлы", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
    const storage = new AppStorage({ projectRoot: tempRoot });

    const data = await storage.load();

    expect(data.studentsFile.students).toEqual([]);
    expect(data.projectsFile.projects).toEqual([]);
    expect(data.aiAnalysisJobsFile.aiAnalysisJobs).toEqual([]);
    expect(data.settingsFile.settings.dataRoot).toBe("data");

    const studentsJson = await readFile(
      join(tempRoot, "data", "app", "students.json"),
      "utf8",
    );

    expect(studentsJson.endsWith("\n")).toBe(true);
    expect(JSON.parse(studentsJson)).toEqual({
      schemaVersion: 1,
      students: [],
    });

    const aiJobsJson = await readFile(
      join(tempRoot, "data", "app", "ai-analysis-jobs.json"),
      "utf8",
    );

    expect(aiJobsJson.endsWith("\n")).toBe(true);
    expect(JSON.parse(aiJobsJson)).toEqual({
      schemaVersion: 1,
      aiAnalysisJobs: [],
    });
  });

  it("не создает локальную папку data при чтении через Supabase", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
    const storage = new AppStorage({
      backend: "supabase",
      projectRoot: tempRoot,
      supabaseClient: createEmptySupabaseClient(),
    });

    const data = await storage.load();

    expect(data.settingsFile.settings.dataRoot).toBe("data");
    expect(data.studentsFile.students).toEqual([]);
    expect(await pathExists(join(tempRoot, "data"))).toBe(false);
  });
});

function createEmptySupabaseClient(): SupabaseClient {
  return {
    from() {
      return {
        select() {
          return Promise.resolve({
            data: [],
            error: null,
          });
        },
      };
    },
  } as unknown as SupabaseClient;
}
