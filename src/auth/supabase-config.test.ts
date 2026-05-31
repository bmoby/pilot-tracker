import { describe, expect, it } from "vitest";
import {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV,
  NEXT_PUBLIC_SUPABASE_URL_ENV,
  PILOT_SUPABASE_URL_ENV,
  readSupabasePublicConfig,
} from "./supabase-config";

describe("публичная конфигурация Supabase Auth", () => {
  it("читает публичный адрес и publishable key", () => {
    const result = readSupabasePublicConfig({
      [NEXT_PUBLIC_SUPABASE_URL_ENV]: "https://example.supabase.co",
      [NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV]: "sb_publishable_test",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
      },
    });
  });

  it("поддерживает существующий адрес PILOT_SUPABASE_URL", () => {
    const result = readSupabasePublicConfig({
      [PILOT_SUPABASE_URL_ENV]: "https://example.supabase.co",
      [NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV]: "sb_publishable_test",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.url).toBe("https://example.supabase.co");
    }
  });

  it("использует PILOT_SUPABASE_URL, если публичный адрес пустой", () => {
    const result = readSupabasePublicConfig({
      [NEXT_PUBLIC_SUPABASE_URL_ENV]: "",
      [PILOT_SUPABASE_URL_ENV]: "https://example.supabase.co",
      [NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV]: "sb_publishable_test",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.url).toBe("https://example.supabase.co");
    }
  });

  it("не раскрывает секреты в ошибке отсутствующей конфигурации", () => {
    const result = readSupabasePublicConfig({
      [NEXT_PUBLIC_SUPABASE_URL_ENV]: "https://example.supabase.co",
      [NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV]: "",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("supabase_auth_configuration_missing");
      expect(result.error.message).not.toContain("secret");
      expect(result.error.details).not.toContain("secret");
    }
  });

  it("отклоняет некорректный адрес Supabase", () => {
    const result = readSupabasePublicConfig({
      [NEXT_PUBLIC_SUPABASE_URL_ENV]: "не адрес",
      [NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV]: "sb_publishable_test",
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("supabase_url_invalid");
    }
  });
});
