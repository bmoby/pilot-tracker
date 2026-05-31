"use server";

import { revalidatePath } from "next/cache";
import { runEnvironmentDiagnostics } from "@/application/environment-diagnostics";
import { createAuthenticatedAppStorage } from "@/auth/server";

export type SettingsActionState = {
  ok: boolean;
  message: string;
};

export async function runEnvironmentDiagnosticsAction(): Promise<SettingsActionState> {
  const storage = await createAuthenticatedAppStorage();

  if (!storage.ok) {
    return {
      ok: false,
      message: storage.error.message,
    };
  }

  const result = await runEnvironmentDiagnostics({ storage: storage.value });

  if (!result.ok) {
    return {
      ok: false,
      message: result.error.message,
    };
  }

  revalidatePath("/settings");

  return {
    ok: true,
    message: "Диагностика окружения завершена.",
  };
}
