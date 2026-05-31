import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../supabase/migrations/20260531093016_admin_auth_rls.sql",
  import.meta.url,
);

const protectedTables = [
  "students",
  "projects",
  "update_runs",
  "update_events",
  "review_statuses",
  "comments",
  "ai_analysis_jobs",
  "ai_reports",
  "project_ai_descriptions",
];

describe("миграция RLS для входа администратора", () => {
  it("перечисляет все таблицы приложения", async () => {
    const migration = await readFile(migrationUrl, "utf8");

    for (const tableName of protectedTables) {
      expect(migration).toContain(`'${tableName}'`);
    }
  });

  it("использует только app_metadata для проверки роли", async () => {
    const migration = await readFile(migrationUrl, "utf8");

    expect(migration).toContain("app_metadata");
    expect(migration).toContain("pilot_tracker_role");
    expect(migration).toContain("'admin'");
    expect(migration).not.toContain("user_metadata");
  });

  it("включает RLS, закрывает anon и выдает доступ authenticated", async () => {
    const migration = await readFile(migrationUrl, "utf8");

    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.%I from anon");
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.%I to authenticated",
    );
  });
});
