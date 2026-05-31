import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSessionFromClaims, type AdminSession } from "./admin";
import { createLoginPath } from "./routes";
import { readSupabasePublicConfig } from "./supabase-config";
import { AppStorage } from "@/storage/app-storage";
import { failure, success, type AppResult } from "@/shared/result";

export async function createSupabaseAuthServerClient(): Promise<SupabaseClient> {
  const config = readSupabasePublicConfig();

  if (!config.ok) {
    throw new SupabaseAuthConfigurationError(config.error.message);
  }

  const cookieStore = await cookies();

  return createServerClient(config.value.url, config.value.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          return;
        }
      },
    },
  });
}

export async function getCurrentAdminSession(): Promise<
  AppResult<AdminSession>
> {
  try {
    const supabase = await createSupabaseAuthServerClient();
    return getAdminSessionFromClient(supabase);
  } catch (error) {
    if (error instanceof SupabaseAuthConfigurationError) {
      return failure({
        code: "supabase_auth_configuration_missing",
        message: error.message,
      });
    }

    return failure({
      code: "admin_session_error",
      message: "Не удалось проверить вход администратора.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createAuthenticatedAppStorage(): Promise<
  AppResult<AppStorage>
> {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const session = await getAdminSessionFromClient(supabase);

    if (!session.ok) {
      return failure(session.error);
    }

    return success(
      new AppStorage({ backend: "supabase", supabaseClient: supabase }),
    );
  } catch (error) {
    if (error instanceof SupabaseAuthConfigurationError) {
      return failure({
        code: "supabase_auth_configuration_missing",
        message: error.message,
      });
    }

    return failure({
      code: "admin_session_error",
      message: "Не удалось подготовить защищенный доступ к данным.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export function redirectToLogin(error?: string, nextPath?: string): never {
  redirect(createLoginPath(error, nextPath));
}

async function getAdminSessionFromClient(
  supabase: SupabaseClient,
): Promise<AppResult<AdminSession>> {
  const { data, error } = await supabase.auth.getClaims();

  if (error !== null || data?.claims === undefined) {
    return failure({
      code: "admin_session_missing",
      message: "Войдите как администратор, чтобы продолжить.",
      details: error?.message,
    });
  }

  const session = getAdminSessionFromClaims(data.claims);

  if (session === null) {
    return failure({
      code: "admin_access_denied",
      message: "Доступ разрешен только администратору.",
    });
  }

  return success(session);
}

class SupabaseAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAuthConfigurationError";
  }
}
