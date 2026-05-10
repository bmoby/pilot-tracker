"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import type { StudentDetailsData, UpdateEventListItem } from "@/application/project-updates";
import { AppShell } from "./app-shell";
import { type StudentActionState, updateSingleProjectAction } from "./students-actions";

type StudentDetailPageProps = {
  data: StudentDetailsData;
};

export function StudentDetailPage({ data }: StudentDetailPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<StudentActionState | null>(null);
  const updateDisabled = data.project.repositoryUrl === null || isPending;

  function updateProject() {
    const formData = new FormData();
    formData.set("studentId", data.student.id);

    startTransition(async () => {
      const result = await updateSingleProjectAction(formData);
      setMessage(result);
      router.refresh();
    });
  }

  return (
    <AppShell activeSection="students">
      <section className="grid gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Студенты
            </Link>
            <p className="mt-5 text-sm font-medium text-teal-700">Карточка студента</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">{data.student.displayName}</h1>
            {data.student.notes ? (
              <p className="mt-2 max-w-3xl text-sm text-slate-600">{data.student.notes}</p>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
            onClick={updateProject}
            disabled={updateDisabled}
            title={
              data.project.repositoryUrl === null
                ? "Сначала добавьте GitHub-ссылку студента"
                : "Обновить проект студента"
            }
          >
            <RefreshCw size={18} aria-hidden="true" />
            {isPending ? "Обновление..." : "Обновить проект"}
          </button>
        </div>

        {message ? (
          <div
            className={[
              "flex items-start gap-3 rounded-lg border bg-white p-4 text-sm",
              message.ok ? "border-emerald-200 text-emerald-800" : "border-red-200 text-red-900",
            ].join(" ")}
          >
            {message.ok ? (
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            )}
            <p>{message.message}</p>
          </div>
        ) : null}

        <ProjectContext data={data} />
        <UpdatesTimeline events={data.events} />
      </section>
    </AppShell>
  );
}

function ProjectContext({ data }: { data: StudentDetailsData }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-950">Проект</h2>
            <span className="inline-flex min-h-7 items-center rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-xs font-medium text-teal-800">
              {data.project.statusLabel}
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <InfoLine
              icon={<GitBranch size={16} aria-hidden="true" />}
              label={data.project.repositoryUrl ?? "GitHub-ссылка не указана"}
            />
            <InfoLine label={data.project.localPath ?? "Локальная копия еще не создана"} />
            <InfoLine label={`Ветка: ${data.project.defaultBranch}`} />
            <InfoLine
              label={
                data.project.lastKnownCommit
                  ? `Последний коммит: ${shortCommit(data.project.lastKnownCommit)}`
                  : "Последний коммит еще не зафиксирован"
              }
            />
            <InfoLine
              label={
                data.project.lastUpdatedAt
                  ? `Последнее обновление: ${formatDateTime(data.project.lastUpdatedAt)}`
                  : "Обновлений еще не было"
              }
            />
          </div>
          {data.project.lastError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {data.project.lastError}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">ИИ-описание проекта</p>
          <p className="mt-2 text-sm text-slate-600">
            {data.project.aiDescriptionSummary ?? "Описание пока отсутствует."}
          </p>
        </div>
      </div>
    </section>
  );
}

function UpdatesTimeline({ events }: { events: UpdateEventListItem[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Clock3 size={24} aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-950">Лента обновлений пуста</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Запустите обновление проекта, чтобы сохранить первое событие истории.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-teal-700">История проекта</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">Лента обновлений</h2>
      </div>
      {events.map((event) => (
        <UpdateEventCard key={event.id} event={event} />
      ))}
    </section>
  );
}

function UpdateEventCard({ event }: { event: UpdateEventListItem }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-950">{event.resultLabel}</h3>
            <span className="inline-flex min-h-7 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
              {event.reviewStatusLabel}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {formatDateTime(event.occurredAt ?? event.startedAt)}
          </p>
          <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <InfoLine label={`Ветка: ${event.branch}`} />
            <InfoLine
              label={
                event.newCommitsCount === null
                  ? "Количество новых коммитов не вычислялось"
                  : `Новых коммитов: ${event.newCommitsCount}`
              }
            />
            <InfoLine
              label={
                event.previousCommit
                  ? `Старый коммит: ${shortCommit(event.previousCommit)}`
                  : "Старый коммит отсутствует"
              }
            />
            <InfoLine
              label={
                event.newCommit
                  ? `Новый коммит: ${shortCommit(event.newCommit)}`
                  : "Новый коммит отсутствует"
              }
            />
          </div>
          {event.error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {event.error}
            </p>
          ) : null}
        </div>

        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 lg:w-80">
          <summary className="cursor-pointer font-medium text-slate-900">Детали события</summary>
          <div className="mt-3 grid gap-2">
            <p>Репозиторий: {event.repositoryUrlSnapshot ?? "не указан"}</p>
            <p>Локальный путь: {event.projectLocalPathSnapshot ?? "не сохранен"}</p>
            <p>Статус события: {formatEventStatus(event.status)}</p>
          </div>
        </details>
      </div>
    </article>
  );
}

function InfoLine({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <p className="flex min-w-0 items-center gap-2">
      {icon ? <span className="text-slate-400">{icon}</span> : null}
      <span className="break-words">{label}</span>
    </p>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortCommit(value: string): string {
  return value.slice(0, 7);
}

function formatEventStatus(status: UpdateEventListItem["status"]): string {
  if (status === "running") {
    return "выполняется";
  }

  if (status === "completed") {
    return "завершено";
  }

  if (status === "failed") {
    return "ошибка";
  }

  return "прервано";
}
