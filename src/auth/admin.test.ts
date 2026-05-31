import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getAdminSessionFromClaims, getAdminSessionFromUser } from "./admin";

describe("проверка роли администратора", () => {
  it("создает сессию администратора из app_metadata JWT", () => {
    const session = getAdminSessionFromClaims({
      sub: "user_1",
      email: "admin@example.com",
      app_metadata: {
        pilot_tracker_role: "admin",
      },
    });

    expect(session).toEqual({
      userId: "user_1",
      email: "admin@example.com",
    });
  });

  it("не принимает роль администратора из user_metadata", () => {
    const session = getAdminSessionFromClaims({
      sub: "user_1",
      email: "admin@example.com",
      user_metadata: {
        pilot_tracker_role: "admin",
      },
    });

    expect(session).toBeNull();
  });

  it("не создает сессию без идентификатора пользователя", () => {
    const session = getAdminSessionFromClaims({
      sub: "",
      app_metadata: {
        pilot_tracker_role: "admin",
      },
    });

    expect(session).toBeNull();
  });

  it("создает сессию администратора из пользователя Supabase", () => {
    const user = createTestUser({
      app_metadata: {
        pilot_tracker_role: "admin",
      },
    });

    expect(getAdminSessionFromUser(user)).toEqual({
      userId: "user_2",
      email: "teacher@example.com",
    });
  });

  it("отклоняет пользователя Supabase без роли администратора", () => {
    const user = createTestUser({
      app_metadata: {
        pilot_tracker_role: "viewer",
      },
    });

    expect(getAdminSessionFromUser(user)).toBeNull();
  });
});

function createTestUser(options: {
  app_metadata: Record<string, unknown>;
}): User {
  return {
    id: "user_2",
    email: "teacher@example.com",
    app_metadata: options.app_metadata,
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-05-31T00:00:00.000Z",
  } as User;
}
