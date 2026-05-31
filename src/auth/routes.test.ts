import { describe, expect, it } from "vitest";
import { createLoginPath, normalizeNextPath } from "./routes";

describe("пути входа администратора", () => {
  it("сохраняет безопасный внутренний путь возврата", () => {
    expect(normalizeNextPath("/students/student_1?tab=updates")).toBe(
      "/students/student_1?tab=updates",
    );
  });

  it("заменяет внешний путь возврата на главную страницу", () => {
    expect(normalizeNextPath("https://example.com")).toBe("/");
    expect(normalizeNextPath("//example.com")).toBe("/");
  });

  it("не возвращает администратора обратно на страницу входа", () => {
    expect(normalizeNextPath("/login?next=/settings")).toBe("/");
  });

  it("создает путь входа с кодом ошибки и безопасным возвратом", () => {
    expect(createLoginPath("session", "/settings")).toBe(
      "/login?error=session&next=%2Fsettings",
    );
  });

  it("переводит внутренние коды доступа в пользовательские коды входа", () => {
    expect(createLoginPath("admin_access_denied", "/")).toBe(
      "/login?error=access",
    );
    expect(createLoginPath("admin_session_missing", "/")).toBe(
      "/login?error=session",
    );
    expect(createLoginPath("supabase_auth_configuration_missing", "/")).toBe(
      "/login?error=configuration",
    );
  });
});
