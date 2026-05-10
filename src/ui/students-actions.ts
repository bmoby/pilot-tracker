"use server";

import { revalidatePath } from "next/cache";
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

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
