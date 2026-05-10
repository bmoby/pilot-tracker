import { describe, expect, it } from "vitest";
import {
  createStudentAndProject,
  isGithubRepositoryUrl,
  normalizeStudentInput,
} from "./student-rules";

describe("правила студента", () => {
  it("отклоняет пустое имя", () => {
    const result = normalizeStudentInput({
      displayName: "   ",
    });

    expect(result.ok).toBe(false);
  });

  it("принимает студента без GitHub-ссылки", () => {
    const result = normalizeStudentInput({
      displayName: "Анна",
      notes: "Проект на React",
      repositoryUrl: "",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        displayName: "Анна",
        notes: "Проект на React",
        repositoryUrl: null,
      },
    });
  });

  it("проверяет допустимые формы ссылки GitHub", () => {
    expect(isGithubRepositoryUrl("https://github.com/course/project")).toBe(true);
    expect(isGithubRepositoryUrl("git@github.com:course/project.git")).toBe(true);
    expect(isGithubRepositoryUrl("https://example.com/course/project")).toBe(false);
  });

  it("создает связанный проект со статусом без обновления", () => {
    const normalized = normalizeStudentInput({
      displayName: "Иван",
      repositoryUrl: "https://github.com/course/project",
    });

    if (!normalized.ok) {
      throw new Error("Входные данные должны быть валидными.");
    }

    const { student, project } = createStudentAndProject(
      normalized.value,
      "2026-05-10T10:00:00.000Z",
    );

    expect(student.projectId).toBe(project.id);
    expect(project.studentId).toBe(student.id);
    expect(project.status).toBe("never_updated");
  });
});
