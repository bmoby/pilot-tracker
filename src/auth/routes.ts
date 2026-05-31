export function createLoginPath(error?: string, nextPath?: string): string {
  const params = new URLSearchParams();
  const loginError = normalizeLoginError(error);

  if (loginError !== undefined && loginError !== "") {
    params.set("error", loginError);
  }

  const safeNextPath = normalizeNextPath(nextPath);

  if (safeNextPath !== "/") {
    params.set("next", safeNextPath);
  }

  const query = params.toString();
  return query === "" ? "/login" : `/login?${query}`;
}

export function normalizeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    return "/";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/login")) {
    return "/";
  }

  return value;
}

function normalizeLoginError(error: string | undefined): string | undefined {
  const errorMap: Record<string, string> = {
    admin_access_denied: "access",
    admin_session_missing: "session",
    supabase_auth_configuration_missing: "configuration",
  };

  return error === undefined ? undefined : (errorMap[error] ?? error);
}
