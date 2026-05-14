"use server";

import { revalidatePath } from "next/cache";
import { runEnvironmentDiagnostics } from "@/application/environment-diagnostics";

export type SettingsActionState = {
  ok: boolean;
  message: string;
};

export async function runEnvironmentDiagnosticsAction(): Promise<SettingsActionState> {
  const result = await runEnvironmentDiagnostics();

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
