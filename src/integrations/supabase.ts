import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  failure,
  success,
  type AppError,
  type AppResult,
} from "@/shared/result";

export const SUPABASE_URL_ENV = "PILOT_SUPABASE_URL";
export const SUPABASE_SERVICE_ROLE_KEY_ENV =
  "PILOT_SUPABASE_SERVICE_ROLE_KEY";

export type SupabaseEnvironment = Record<string, string | undefined>;

export type SupabaseConnectionConfig = {
  url: string;
  serviceRoleKey: string;
};

export type SupabaseConnectionCheck = {
  checkedAt: string;
};

export function readSupabaseConnectionConfig(
  env: SupabaseEnvironment = process.env,
): AppResult<SupabaseConnectionConfig> {
  const url = env[SUPABASE_URL_ENV]?.trim() ?? "";
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV]?.trim() ?? "";

  if (url === "" || serviceRoleKey === "") {
    return failure({
      code: "supabase_configuration_missing",
      message: "Подключение к Supabase не настроено.",
      details:
        "Заполните PILOT_SUPABASE_URL и PILOT_SUPABASE_SERVICE_ROLE_KEY в локальном .env-файле.",
    });
  }

  const urlError = validateSupabaseUrl(url);

  if (urlError !== null) {
    return failure(urlError);
  }

  return success({
    url,
    serviceRoleKey,
  });
}

export function createSupabaseServerClient(
  config: SupabaseConnectionConfig,
): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function checkSupabaseConnection(
  client = createSupabaseServerClientFromEnv(),
  now: () => Date = () => new Date(),
): Promise<AppResult<SupabaseConnectionCheck>> {
  const { error } = await client
    .from("students")
    .select("id", { count: "exact", head: true });

  if (error !== null) {
    return failure({
      code: "supabase_connection_error",
      message: "Supabase недоступен или схема еще не создана.",
      details: error.message,
    });
  }

  return success({
    checkedAt: now().toISOString(),
  });
}

export function createSupabaseServerClientFromEnv(
  env: SupabaseEnvironment = process.env,
): SupabaseClient {
  const config = readSupabaseConnectionConfig(env);

  if (!config.ok) {
    throw new SupabaseConfigurationError(config.error);
  }

  return createSupabaseServerClient(config.value);
}

export class SupabaseConfigurationError extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = "SupabaseConfigurationError";
    this.appError = appError;
  }
}

function validateSupabaseUrl(value: string): AppError | null {
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
