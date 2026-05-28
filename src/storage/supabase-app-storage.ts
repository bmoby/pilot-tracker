import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClientFromEnv } from "@/integrations/supabase";
import {
  failure,
  success,
  type AppResult,
} from "@/shared/result";

const supabaseStudentRowSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const supabaseProjectRowSchema = z.object({
  id: z.string(),
  student_id: z.string(),
  repository_url: z.string().nullable(),
  default_branch: z.literal("main"),
  current_branch: z.string().nullable(),
  last_known_commit: z.string().nullable(),
  last_updated_at: z.string().nullable(),
  last_update_event_id: z.string().nullable(),
  status: z.string(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SupabaseStudentRow = z.infer<typeof supabaseStudentRowSchema>;
export type SupabaseProjectRow = z.infer<typeof supabaseProjectRowSchema>;

export type SupabaseCatalogData = {
  students: SupabaseStudentRow[];
  projects: SupabaseProjectRow[];
};

export class SupabaseAppStorage {
  constructor(
    private readonly client: SupabaseClient = createSupabaseServerClientFromEnv(),
  ) {}

  async loadCatalog(): Promise<AppResult<SupabaseCatalogData>> {
    const studentsResult = await this.client
      .from("students")
      .select("id, display_name, notes, created_at, updated_at")
      .order("display_name", { ascending: true });

    if (studentsResult.error !== null) {
      return failure({
        code: "supabase_read_error",
        message: "Не удалось прочитать студентов из Supabase.",
        details: studentsResult.error.message,
      });
    }

    const projectsResult = await this.client
      .from("projects")
      .select(
        [
          "id",
          "student_id",
          "repository_url",
          "default_branch",
          "current_branch",
          "last_known_commit",
          "last_updated_at",
          "last_update_event_id",
          "status",
          "last_error",
          "created_at",
          "updated_at",
        ].join(", "),
      );

    if (projectsResult.error !== null) {
      return failure({
        code: "supabase_read_error",
        message: "Не удалось прочитать проекты из Supabase.",
        details: projectsResult.error.message,
      });
    }

    const students = supabaseStudentRowSchema
      .array()
      .safeParse(studentsResult.data);
    const projects = supabaseProjectRowSchema
      .array()
      .safeParse(projectsResult.data);

    if (!students.success || !projects.success) {
      return failure({
        code: "supabase_schema_error",
        message: "Данные Supabase не соответствуют ожидаемой схеме.",
        details: [
          students.success ? null : students.error.message,
          projects.success ? null : projects.error.message,
        ]
          .filter((item) => item !== null)
          .join("\n"),
      });
    }

    return success({
      students: students.data,
      projects: projects.data,
    });
  }
}
