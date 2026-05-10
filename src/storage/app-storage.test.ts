import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppStorage } from "./app-storage";

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
  });
});
