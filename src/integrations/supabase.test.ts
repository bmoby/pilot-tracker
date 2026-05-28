import { describe, expect, it } from "vitest";
import {
  createSupabaseServerClientFromEnv,
  readSupabaseConnectionConfig,
  SUPABASE_SERVICE_ROLE_KEY_ENV,
  SUPABASE_URL_ENV,
  SupabaseConfigurationError,
} from "./supabase";

describe("подключение к Supabase", () => {
  it("читает локальную конфигурацию подключения", () => {
    const result = readSupabaseConnectionConfig({
      [SUPABASE_URL_ENV]: "https://example.supabase.co",
      [SUPABASE_SERVICE_ROLE_KEY_ENV]: "secret",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        url: "https://example.supabase.co",
        serviceRoleKey: "secret",
      },
    });
  });

  it("возвращает ошибку без секретного ключа в тексте", () => {
    const result = readSupabaseConnectionConfig({
      [SUPABASE_URL_ENV]: "https://example.supabase.co",
      [SUPABASE_SERVICE_ROLE_KEY_ENV]: "",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("supabase_configuration_missing");
      expect(result.error.message).not.toContain("secret");
      expect(result.error.details).not.toContain("secret");
    }
  });

  it("отклоняет некорректный адрес Supabase", () => {
    const result = readSupabaseConnectionConfig({
      [SUPABASE_URL_ENV]: "не адрес",
      [SUPABASE_SERVICE_ROLE_KEY_ENV]: "secret",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("supabase_url_invalid");
    }
  });

  it("не создает клиент без локальной конфигурации", () => {
    expect(() => createSupabaseServerClientFromEnv({})).toThrow(
      SupabaseConfigurationError,
    );
  });
});
