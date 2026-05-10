import { getSettingsOverview } from "@/application/settings";
import { AppShell } from "@/ui/app-shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SettingsPage() {
  const result = await getSettingsOverview();

  return (
    <AppShell activeSection="settings">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium text-teal-700">Настройки</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Локальная среда</h1>
        </div>

        {!result.ok ? (
          <div className="rounded-lg border border-red-200 bg-white p-5 text-red-900">
            <p className="font-semibold">Настройки не загружены</p>
            <p className="mt-2 text-sm">{result.error.message}</p>
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-950">Пути данных</h2>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <PathRow label="Базовая папка данных" value={result.value.dataRoot} />
                <PathRow label="JSON-данные" value={result.value.appDataPath} />
                <PathRow label="Репозитории" value={result.value.repositoriesPath} />
                <PathRow label="Review-копии" value={result.value.reviewCopiesPath} />
                <PathRow label="Будущие резервные копии" value={result.value.backupsPath} />
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-950">Локальные инструменты</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {result.value.tools.map((tool) => (
                  <div key={tool.name} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-medium text-slate-950">{tool.name}</p>
                    <p className="mt-2 text-sm text-slate-600">Команда: {tool.command}</p>
                    <p className="mt-1 text-sm text-slate-600">Статус: {tool.statusLabel}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </AppShell>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 break-all font-mono text-sm text-slate-900">{value}</dd>
    </div>
  );
}
