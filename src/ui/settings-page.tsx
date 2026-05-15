"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
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
      <section className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-400">Настройки</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-neutral-950">
              Локальная среда
            </h1>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.12)] hover:bg-neutral-800 disabled:opacity-60"
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
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
              message.ok
                ? "bg-[#edf8ef] text-[#4fa75b]"
                : "bg-[#fff1ed] text-[#d45b51]",
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

        <section className="grid gap-4">
          <h2 className="text-lg font-semibold text-neutral-950">Пути данных</h2>
          <div className="grid gap-3 md:grid-cols-2">
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
                <p className="break-all font-mono text-sm text-neutral-900">
                  {path.value}
                </p>
              </DiagnosticCard>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-lg font-semibold text-neutral-950">
            Локальные инструменты
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
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
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Команда
                    </dt>
                    <dd className="mt-1 break-all font-mono text-neutral-900">
                      {tool.command}
                    </dd>
                  </div>
                  {tool.version ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Версия
                      </dt>
                      <dd className="mt-1 text-neutral-700">{tool.version}</dd>
                    </div>
                  ) : null}
                  {tool.authStatusLabel ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        GitHub
                      </dt>
                      <dd className="mt-1 text-neutral-700">
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
    <article className="rounded-lg bg-white p-4 shadow-[0_16px_42px_rgba(0,0,0,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-neutral-950">{title}</h3>
        <StatusBadge status={status} label={statusLabel} />
      </div>
      <div className="mt-3">{children}</div>
      {message ? (
        <p className="mt-3 text-sm text-neutral-600">{message}</p>
      ) : null}
      {checkedAt ? (
        <p className="mt-2 text-xs text-neutral-400">
          Проверено: {formatDateTime(checkedAt)}
        </p>
      ) : null}
      {details ? (
        <details className="mt-3 text-xs text-neutral-500">
          <summary className="cursor-pointer font-medium text-neutral-700">
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
    unknown: "bg-[#f5f5f3] text-neutral-500",
    running: "bg-[#eef7ff] text-[#3e79ac]",
    success: "bg-[#edf8ef] text-[#4fa75b]",
    warning: "bg-[#fff7e8] text-[#b87522]",
    error: "bg-[#fff1ed] text-[#d45b51]",
  };

  const icon =
    status === "success" ? (
      <CheckCircle2 size={15} aria-hidden="true" />
    ) : status === "error" ? (
      <AlertCircle size={15} aria-hidden="true" />
    ) : (
      <Clock3 size={15} aria-hidden="true" />
    );

  return (
    <span
      className={[
        "inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-sm font-medium",
        classes[status],
      ].join(" ")}
    >
      {icon}
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
