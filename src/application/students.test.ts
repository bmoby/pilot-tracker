import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppStorage } from "@/storage/app-storage";
import { createStudent, deleteStudent, listStudents, updateStudent } from "./students";

let tempRoot: string | null = null;

async function createStorage() {
  tempRoot = await mkdtemp(join(tmpdir(), "pilot-tracker-"));
  return new AppStorage({ projectRoot: tempRoot });
}

describe("сценарии студентов", () => {
  afterEach(async () => {
    if (tempRoot !== null) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("создает студента и связанный проект", async () => {
    const storage = await createStorage();
    const result = await createStudent(
      {
        displayName: "Мария",
        notes: "Первый поток",
        repositoryUrl: "https://github.com/course/maria",
      },
      storage,
    );

    expect(result.ok).toBe(true);

    const list = await listStudents(storage);

    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.students).toHaveLength(1);
      expect(list.value.students[0]?.status).toBe("never_updated");
      expect(list.value.students[0]?.repositoryUrl).toBe("https://github.com/course/maria");
    }
  });

  it("сохраняет студента без репозитория как неподключенный проект", async () => {
    const storage = await createStorage();
    const result = await createStudent(
      {
        displayName: "Олег",
      },
      storage,
    );

    expect(result.ok).toBe(true);

    const list = await listStudents(storage);

    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.students[0]?.status).toBe("not_connected");
    }
  });

  it("редактирует карточку студента до первой загрузки проекта", async () => {
    const storage = await createStorage();
    const created = await createStudent({ displayName: "Лена" }, storage);

    if (!created.ok) {
      throw new Error("Студент должен быть создан.");
    }

    const studentId = created.value.students[0]?.studentId;

    if (studentId === undefined) {
      throw new Error("Идентификатор студента должен существовать.");
    }

    const updated = await updateStudent(
      {
        studentId,
        displayName: "Елена",
        notes: "GitHub добавлен позже",
        repositoryUrl: "https://github.com/course/elena",
      },
      storage,
    );

    expect(updated.ok).toBe(true);

    const list = await listStudents(storage);

    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.students[0]?.displayName).toBe("Елена");
      expect(list.value.students[0]?.status).toBe("never_updated");
    }
  });

  it("удаляет студента только после подтверждения", async () => {
    const storage = await createStorage();
    const created = await createStudent({ displayName: "Павел" }, storage);

    if (!created.ok) {
      throw new Error("Студент должен быть создан.");
    }

    const studentId = created.value.students[0]?.studentId;

    if (studentId === undefined) {
      throw new Error("Идентификатор студента должен существовать.");
    }

    const blocked = await deleteStudent({ studentId, confirmed: false }, storage);
    expect(blocked.ok).toBe(false);

    const deleted = await deleteStudent({ studentId, confirmed: true }, storage);
    expect(deleted.ok).toBe(true);

    const list = await listStudents(storage);

    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.students).toHaveLength(0);
    }
  });
});
