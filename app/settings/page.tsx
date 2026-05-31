import { getSettingsOverview } from "@/application/settings";
import { createAuthenticatedAppStorage, redirectToLogin } from "@/auth/server";
import { AppShell } from "@/ui/app-shell";
import { SettingsPage as SettingsOverviewPage } from "@/ui/settings-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SettingsRoute() {
  const storage = await createAuthenticatedAppStorage();

  if (!storage.ok) {
    redirectToLogin(storage.error.code, "/settings");
  }

  const result = await getSettingsOverview(storage.value);

  if (!result.ok) {
    return (
      <AppShell activeSection="settings">
        <section className="space-y-6">
          <div>
            <p className="text-sm font-medium text-teal-700">Настройки</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">
              Локальная среда
            </h1>
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-5 text-red-900">
            <p className="font-semibold">Настройки не загружены</p>
            <p className="mt-2 text-sm">{result.error.message}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  return <SettingsOverviewPage overview={result.value} />;
}
