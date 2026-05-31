import type { User } from "@supabase/supabase-js";

export const ADMIN_ROLE_METADATA_KEY = "pilot_tracker_role";
export const ADMIN_ROLE_METADATA_VALUE = "admin";

export type AdminSession = {
  userId: string;
  email: string | null;
};

type MetadataRecord = Record<string, unknown>;

export function getAdminSessionFromClaims(
  claims: unknown,
): AdminSession | null {
  if (!isRecord(claims)) {
    return null;
  }

  const appMetadata = readRecord(claims.app_metadata);

  if (!hasAdminRole(appMetadata)) {
    return null;
  }

  const userId = typeof claims.sub === "string" ? claims.sub : null;

  if (userId === null || userId.trim() === "") {
    return null;
  }

  return {
    userId,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}

export function getAdminSessionFromUser(
  user: User | null,
): AdminSession | null {
  if (user === null || !hasAdminRole(user.app_metadata)) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
  };
}

function hasAdminRole(metadata: MetadataRecord | null): boolean {
  return metadata?.[ADMIN_ROLE_METADATA_KEY] === ADMIN_ROLE_METADATA_VALUE;
}

function readRecord(value: unknown): MetadataRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is MetadataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
