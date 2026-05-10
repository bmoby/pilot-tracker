"use server";

import { revalidatePath } from "next/cache";
import { updateAllProjects, updateSingleProject } from "@/application/project-updates";
import { createStudent, deleteStudent, updateStudent } from "@/application/students";

export type StudentActionState = {
  ok: boolean;
  message: string;
};

export async function createStudentAction(formData: FormData): Promise<StudentActionState> {
  const result = await createStudent({
    displayName: getFormString(formData, "displayName"),
    notes: getFormString(formData, "notes"),
    repositoryUrl: getFormString(formData, "repositoryUrl"),
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePath("/");

  return {
    ok: true,
    message: "Студент сохранен.",
  };
}

export async function updateStudentAction(formData: FormData): Promise<StudentActionState> {
  const result = await updateStudent({
    studentId: getFormString(formData, "studentId"),
    displayName: getFormString(formData, "displayName"),
    notes: getFormString(formData, "notes"),
    repositoryUrl: getFormString(formData, "repositoryUrl"),
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePath("/");

  return {
    ok: true,
    message: "Карточка студента обновлена.",
  };
}

export async function deleteStudentAction(formData: FormData): Promise<StudentActionState> {
  const result = await deleteStudent({
    studentId: getFormString(formData, "studentId"),
    confirmed: getFormString(formData, "confirmed") === "true",
  });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePath("/");

  return {
    ok: true,
    message: "Студент удален.",
  };
}

export async function updateAllProjectsAction(): Promise<StudentActionState> {
  const result = await updateAllProjects();

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePath("/");

  return {
    ok: true,
    message: buildUpdateMessage(result.value.run.summary),
  };
}

export async function updateSingleProjectAction(formData: FormData): Promise<StudentActionState> {
  const studentId = getFormString(formData, "studentId");
  const result = await updateSingleProject(studentId);

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePath("/");
  revalidatePath(`/students/${studentId}`);

  return {
    ok: true,
    message: buildUpdateMessage(result.value.run.summary),
  };
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function buildUpdateMessage(summary: {
  projectsFirstLoaded: number;
  projectsWithChanges: number;
  projectsWithoutChanges: number;
  errorsTotal: number;
  studentsWithoutRepository: number;
}): string {
  return [
    "Обновление завершено.",
    `Первая загрузка: ${summary.projectsFirstLoaded}.`,
    `С новыми изменениями: ${summary.projectsWithChanges}.`,
    `Без изменений: ${summary.projectsWithoutChanges}.`,
    `Ошибок: ${summary.errorsTotal}.`,
    `Без репозитория: ${summary.studentsWithoutRepository}.`,
  ].join(" ");
}
