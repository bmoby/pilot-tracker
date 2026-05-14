"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import type { DiagnosticsStatus } from "@/domain/schemas";
import type { SettingsOverview } from "@/application/settings";
import {
  runEnvironmentDiagnosticsAction,
  type SettingsActionState,
} from "./settings-actions";
import { AppShell } from "./app-shell";

type SettingsPageProps = {
  overview: SettingsOverview;
};

export function SettingsPage({ overview }: SettingsPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<SettingsActionState | null>(null);

  function runDiagnostics() {
    startTransition(async () => {
      const result = await runEnvironmentDiagnosticsAction();
      setMessage(result);
      router.refresh();
    });
  }

  return (
    <AppShell activeSection="settings">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">Настройки</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">
              Локальная среда
            </h1>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
            onClick={runDiagnostics}
            disabled={isPending}
          >
            <RefreshCw size={18} aria-hidden="true" />
            {isPending ? "Проверка..." : "Проверить окружение"}
          </button>
        </div>

        {message ? (
          <div
            className={[
              "flex items-start gap-3 rounded-lg border bg-white p-4 text-sm",
              message.ok
                ? "border-emerald-200 text-emerald-800"
                : "border-red-200 text-red-900",
            ].join(" ")}
          >
            {message.ok ? (
              <CheckCircle2
                className="mt-0.5 shrink-0"
                size={18}
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="mt-0.5 shrink-0"
                size={18}
                aria-hidden="true"
              />
            )}
            <p>{message.message}</p>
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Пути данных</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.paths.map((path) => (
              <DiagnosticCard
                key={path.key}
                title={path.name}
                status={path.status}
                statusLabel={path.statusLabel}
                message={path.message}
                details={path.details}
                checkedAt={path.checkedAt}
              >
                <p className="break-all font-mono text-sm text-slate-900">
                  {path.value}
                </p>
              </DiagnosticCard>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Локальные инструменты
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.tools.map((tool) => (
              <DiagnosticCard
                key={tool.key}
                title={tool.name}
                status={tool.status}
                statusLabel={tool.statusLabel}
                message={tool.message}
                details={tool.details}
                checkedAt={tool.checkedAt}
              >
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Команда
                    </dt>
                    <dd className="mt-1 break-all font-mono text-slate-900">
                      {tool.command}
                    </dd>
                  </div>
                  {tool.version ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Версия
                      </dt>
                      <dd className="mt-1 text-slate-700">{tool.version}</dd>
                    </div>
                  ) : null}
                  {tool.authStatusLabel ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        GitHub
                      </dt>
                      <dd className="mt-1 text-slate-700">
                        {tool.authStatusLabel}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </DiagnosticCard>
            ))}
          </div>
        </section>
      </section>
    </AppShell>
  );
}

function DiagnosticCard({
  title,
  status,
  statusLabel,
  message,
  details,
  checkedAt,
  children,
}: {
  title: string;
  status: DiagnosticsStatus;
  statusLabel: string;
  message: string | null;
  details: string | null;
  checkedAt: string | null;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <StatusBadge status={status} label={statusLabel} />
      </div>
      <div className="mt-3">{children}</div>
      {message ? (
        <p className="mt-3 text-sm text-slate-700">{message}</p>
      ) : null}
      {checkedAt ? (
        <p className="mt-2 text-xs text-slate-500">
          Проверено: {formatDateTime(checkedAt)}
        </p>
      ) : null}
      {details ? (
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            Технические детали
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words">{details}</p>
        </details>
      ) : null}
    </article>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: DiagnosticsStatus;
  label: string;
}) {
  const classes: Record<DiagnosticsStatus, string> = {
    unknown: "border-slate-200 bg-slate-50 text-slate-700",
    running: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <span
      className={[
        "inline-flex min-h-7 items-center rounded-lg border px-2.5 text-xs font-medium",
        classes[status],
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
