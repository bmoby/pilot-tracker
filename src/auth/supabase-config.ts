import { failure, success, type AppResult } from "@/shared/result";

export const NEXT_PUBLIC_SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
export const NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV =
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
export const PILOT_SUPABASE_URL_ENV = "PILOT_SUPABASE_URL";

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export type SupabasePublicEnvironment = Record<string, string | undefined>;

export function readSupabasePublicConfig(
  env: SupabasePublicEnvironment = process.env,
): AppResult<SupabasePublicConfig> {
  const publicUrl = env[NEXT_PUBLIC_SUPABASE_URL_ENV]?.trim() ?? "";
  const pilotUrl = env[PILOT_SUPABASE_URL_ENV]?.trim() ?? "";
  const url = publicUrl !== "" ? publicUrl : pilotUrl;
  const publishableKey =
    env[NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_ENV]?.trim() ?? "";

  if (url === "" || publishableKey === "") {
    return failure({
      code: "supabase_auth_configuration_missing",
      message: "Вход администратора не настроен.",
      details:
        "Заполните NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY в локальном .env-файле.",
    });
  }

  const urlError = validateSupabaseUrl(url);

  if (urlError !== null) {
    return failure(urlError);
  }

  return success({
    url,
    publishableKey,
  });
}

function validateSupabaseUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return {
      code: "supabase_url_invalid",
      message: "Адрес Supabase указан некорректно.",
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      code: "supabase_url_invalid",
      message: "Адрес Supabase должен начинаться с http или https.",
    };
  }

  return null;
}
