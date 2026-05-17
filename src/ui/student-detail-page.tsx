"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  ChevronDown,
  CheckCircle2,
  Clock3,
  FileCode2,
  GitBranch,
  MessageSquare,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import type {
  StudentDetailsData,
  UpdateEventListItem,
} from "@/application/project-updates";
import { AppShell } from "./app-shell";
import {
  addReviewCommentAction,
  deleteReviewCommentAction,
  openUpdateCodeAction,
  runAiAnalysisAction,
  type StudentActionState,
  updateReviewStatusAction,
  updateSingleProjectAction,
} from "./students-actions";

type StudentDetailPageProps = {
  data: StudentDetailsData;
};

export function StudentDetailPage({ data }: StudentDetailPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<StudentActionState | null>(null);
  const [formMessages, setFormMessages] = useState<
    Record<string, StudentActionState | undefined>
  >({});
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

  function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const key = getAddCommentFormKey(getFormString(formData, "updateEventId"));
    clearFormMessage(key);

    startTransition(async () => {
      const result = await addReviewCommentAction(formData);
      setScopedFormMessage(key, result);

      if (result.ok) {
        form.reset();
        setMessage(result);
        router.refresh();
      } else {
        setMessage(null);
      }
    });
  }

  function deleteComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.confirm("Удалить комментарий? Это действие нельзя отменить.")) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const key = getDeleteCommentFormKey(getFormString(formData, "commentId"));
    clearFormMessage(key);

    startTransition(async () => {
      const result = await deleteReviewCommentAction(formData);
      setScopedFormMessage(key, result);

      if (result.ok) {
        setMessage(result);
        router.refresh();
      } else {
        setMessage(null);
      }
    });
  }

  function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const key = getStatusFormKey(getFormString(formData, "updateEventId"));
    clearFormMessage(key);

    startTransition(async () => {
      const result = await updateReviewStatusAction(formData);
      setScopedFormMessage(key, result);

      if (result.ok) {
        setMessage(result);
        router.refresh();
      } else {
        setMessage(null);
      }
    });
  }

  function openCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const key = getOpenCodeFormKey(getFormString(formData, "updateEventId"));
    clearFormMessage(key);

    startTransition(async () => {
      const result = await openUpdateCodeAction(formData);
      setScopedFormMessage(key, result);

      if (result.ok) {
        setMessage(result);
        router.refresh();
      } else {
        setMessage(null);
      }
    });
  }

  function runAiAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const key = getAiAnalysisFormKey(getFormString(formData, "updateEventId"));
    clearFormMessage(key);

    startTransition(async () => {
      const result = await runAiAnalysisAction(formData);
      setScopedFormMessage(key, result);

      if (result.ok) {
        setMessage(result);
      } else {
        setMessage(null);
      }

      router.refresh();
    });
  }

  function setScopedFormMessage(key: string, result: StudentActionState) {
    setFormMessages((current) => {
      const next = { ...current };

      if (result.ok) {
        delete next[key];
      } else {
        next[key] = result;
      }

      return next;
    });
  }

  function clearFormMessage(key: string) {
    setFormMessages((current) => {
      if (current[key] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  return (
    <AppShell activeSection="students">
      <section className="grid gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#f7f7f5] px-3 text-sm font-medium text-neutral-700 hover:bg-[#efefec]"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Студенты
            </Link>
            <p className="mt-5 text-sm font-medium text-neutral-400">
              Карточка студента
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-normal text-neutral-950">
              {data.student.displayName}
            </h1>
            {data.student.notes ? (
              <p className="mt-2 max-w-3xl text-sm text-neutral-500">
                {data.student.notes}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.12)] hover:bg-neutral-800 disabled:opacity-60"
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

        <ProjectContext data={data} />
        <UpdatesTimeline
          events={data.events}
          studentId={data.student.id}
          isPending={isPending}
          formMessages={formMessages}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
          onRunAiAnalysis={runAiAnalysis}
          onOpenCode={openCode}
          onUpdateStatus={updateStatus}
        />
      </section>
    </AppShell>
  );
}

function ProjectContext({ data }: { data: StudentDetailsData }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_16px_42px_rgba(0,0,0,0.06)]">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-neutral-950">Проект</h2>
            <StatusPill tone={getLabelTone(data.project.statusLabel)}>
              {data.project.statusLabel}
            </StatusPill>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.project.repositoryUrl ? (
              <a
                href={data.project.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full bg-[#eef7ff] px-3 text-sm font-medium text-[#3e79ac] hover:bg-[#e4f0fb]"
                title={data.project.repositoryUrl}
              >
                <GitBranch size={16} aria-hidden="true" />
                <span className="truncate">
                  {formatRepositoryLabel(data.project.repositoryUrl)}
                </span>
              </a>
            ) : (
              <StatusPill tone="amber">GitHub-ссылка не указана</StatusPill>
            )}
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#f7f7f5] px-3 text-sm font-medium text-neutral-600">
              <Clock3 size={16} aria-hidden="true" />
              {data.project.lastUpdatedAt
                ? formatDateTime(data.project.lastUpdatedAt)
                : "Обновлений еще не было"}
            </span>
          </div>
          {data.project.lastError ? (
            <p className="mt-4 rounded-lg bg-[#fff1ed] p-3 text-sm text-[#d45b51]">
              {data.project.lastError}
            </p>
          ) : null}
          <TechnicalDetails
            summary="Показать технические данные"
            rows={[
              {
                label: "Полная GitHub-ссылка",
                value: data.project.repositoryUrl,
              },
              {
                label: "Локальный путь",
                value: data.project.localPath ?? "Локальная копия еще не создана",
              },
              {
                label: "Ветка",
                value: data.project.defaultBranch,
              },
              {
                label: "Последний коммит",
                value:
                  data.project.lastKnownCommit ??
                  "Последний коммит еще не зафиксирован",
              },
            ]}
          />
        </div>

        <div className="pt-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)] lg:border-l lg:border-[#ebeae7] lg:pt-0 lg:pl-6 lg:shadow-none">
          <p className="text-sm font-medium text-neutral-700">
            ИИ-описание проекта
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            {data.project.aiDescriptionSummary ?? "Описание пока отсутствует."}
          </p>
        </div>
      </div>
    </section>
  );
}

function UpdatesTimeline({
  events,
  studentId,
  isPending,
  formMessages,
  onAddComment,
  onDeleteComment,
  onRunAiAnalysis,
  onOpenCode,
  onUpdateStatus,
}: {
  events: UpdateEventListItem[];
  studentId: string;
  isPending: boolean;
  formMessages: Record<string, StudentActionState | undefined>;
  onAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (event: FormEvent<HTMLFormElement>) => void;
  onRunAiAnalysis: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCode: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateStatus: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (events.length === 0) {
    return (
      <section className="rounded-lg bg-white p-8 text-center shadow-[0_16px_42px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-[#f7f7f5] text-neutral-500">
          <Clock3 size={24} aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-neutral-950">
          Лента обновлений пуста
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-500">
          Запустите обновление проекта, чтобы сохранить первое событие истории.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-neutral-400">История проекта</p>
        <h2 className="mt-1 text-2xl font-semibold text-neutral-950">
          Лента обновлений
        </h2>
      </div>
      {events.map((event) => (
        <UpdateEventCard
          key={event.id}
          event={event}
          studentId={studentId}
          isPending={isPending}
          formMessages={formMessages}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onRunAiAnalysis={onRunAiAnalysis}
          onOpenCode={onOpenCode}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </section>
  );
}

function UpdateEventCard({
  event,
  studentId,
  isPending,
  formMessages,
  onAddComment,
  onDeleteComment,
  onRunAiAnalysis,
  onOpenCode,
  onUpdateStatus,
}: {
  event: UpdateEventListItem;
  studentId: string;
  isPending: boolean;
  formMessages: Record<string, StudentActionState | undefined>;
  onAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (event: FormEvent<HTMLFormElement>) => void;
  onRunAiAnalysis: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCode: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateStatus: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const compactFacts = [
    formatDateTime(event.occurredAt ?? event.startedAt),
    formatNewCommitsLabel(event.newCommitsCount),
  ];

  return (
    <article className="rounded-lg bg-white shadow-[0_16px_42px_rgba(0,0,0,0.06)]">
      <details className="group">
        <summary className="list-none cursor-pointer p-5 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-neutral-950">
                  {event.resultLabel}
                </h3>
                <StatusPill tone={getReviewTone(event.reviewStatus)}>
                  {event.reviewStatusLabel}
                </StatusPill>
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[#f7f7f5] px-2.5 text-xs font-medium text-neutral-600">
                  <MessageSquare size={14} aria-hidden="true" />
                  {event.commentsCount}
                </span>
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[#f7f7f5] px-2.5 text-xs font-medium text-neutral-600">
                  <Bot size={14} aria-hidden="true" />
                  {event.aiReportsCount}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-500">
                {compactFacts.map((fact) => (
                  <span key={fact}>{fact}</span>
                ))}
              </div>
              {event.error ? (
                <p className="mt-4 rounded-lg bg-[#fff1ed] p-3 text-sm text-[#d45b51]">
                  {event.error}
                </p>
              ) : null}
            </div>

            <span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#f7f7f5] px-3 text-sm font-medium text-neutral-800 group-open:bg-neutral-950 group-open:text-white">
              Открыть проверку
              <ChevronDown
                className="transition-transform group-open:rotate-180"
                size={16}
                aria-hidden="true"
              />
            </span>
          </div>
        </summary>

        <div className="border-t border-[#ebeae7] p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
            <div className="grid min-w-0 gap-4">
              <AiReportsList event={event} />
              <CommentsPanel
                event={event}
                studentId={studentId}
                isPending={isPending}
                formMessages={formMessages}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
              />
            </div>

            <div className="grid min-w-0 content-start gap-4">
              <UpdateEventActionsPanel
                event={event}
                studentId={studentId}
                isPending={isPending}
                formMessages={formMessages}
                onRunAiAnalysis={onRunAiAnalysis}
                onOpenCode={onOpenCode}
                onUpdateStatus={onUpdateStatus}
              />
              <UpdateEventContextPanel event={event} />
            </div>
          </div>
        </div>
      </details>
    </article>
  );
}

function UpdateEventContextPanel({
  event,
}: {
  event: UpdateEventListItem;
}) {
  return (
    <section className="rounded-lg bg-[#fbfbfa] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold text-neutral-950">Технические данные</h4>
        <StatusPill tone={getEventTone(event.status)}>
          {formatEventStatus(event.status)}
        </StatusPill>
      </div>
      {event.error ? (
        <p className="mt-4 rounded-lg bg-[#fff1ed] p-3 text-sm text-[#d45b51]">
          {event.error}
        </p>
      ) : null}
      <TechnicalDetails
        summary="Показать значения"
        rows={[
          {
            label: "Дата обновления",
            value: formatDateTime(event.occurredAt ?? event.startedAt),
          },
          {
            label: "Репозиторий",
            value: event.repositoryUrlSnapshot ?? "не указан",
          },
          {
            label: "Локальный путь",
            value: event.projectLocalPathSnapshot ?? "не сохранен",
          },
          {
            label: "Ветка",
            value: event.branch,
          },
          {
            label: "Новые коммиты",
            value:
              event.newCommitsCount === null
                ? "не вычислялись"
                : String(event.newCommitsCount),
          },
          {
            label: "Старый коммит",
            value: event.previousCommit ?? "отсутствует",
          },
          {
            label: "Новый коммит",
            value: event.newCommit ?? "отсутствует",
          },
        ]}
      />
    </section>
  );
}

function UpdateEventActionsPanel({
  event,
  studentId,
  isPending,
  formMessages,
  onRunAiAnalysis,
  onOpenCode,
  onUpdateStatus,
}: {
  event: UpdateEventListItem;
  studentId: string;
  isPending: boolean;
  formMessages: Record<string, StudentActionState | undefined>;
  onRunAiAnalysis: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCode: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateStatus: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeAiJob =
    event.aiAnalysisJob?.status === "queued" ||
    event.aiAnalysisJob?.status === "running";
  const aiButtonLabel =
    event.aiAnalysisJob?.status === "queued"
      ? "ИИ-анализ в очереди"
      : event.aiAnalysisJob?.status === "running"
        ? "ИИ-анализ выполняется"
        : "Поставить ИИ в очередь";
  const aiButtonTitle = activeAiJob
    ? "ИИ-анализ уже ожидает выполнения или выполняется"
    : event.aiAnalysisDisabledReason ??
      "Поставить ИИ-анализ выбранного обновления в очередь";

  return (
    <section className="rounded-lg bg-[#fbfbfa] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold text-neutral-950">Действия проверки</h4>
        <StatusPill tone={getReviewTone(event.reviewStatus)}>
          {event.reviewStatusLabel}
        </StatusPill>
      </div>

      {event.aiAnalysisJob ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <StatusPill tone={getAiJobTone(event.aiAnalysisJob.status)}>
            ИИ: {event.aiAnalysisJob.statusLabel}
          </StatusPill>
          {event.aiAnalysisJob.lastError ? (
            <span>{event.aiAnalysisJob.lastError}</span>
          ) : null}
        </div>
      ) : null}

      <form className="mt-4 grid gap-2" onSubmit={onRunAiAnalysis}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="updateEventId" value={event.id} />
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          disabled={
            isPending || activeAiJob || event.aiAnalysisDisabledReason !== null
          }
          title={aiButtonTitle}
        >
          <Bot size={16} aria-hidden="true" />
          {aiButtonLabel}
        </button>
        {event.aiAnalysisDisabledReason ? (
          <p className="text-sm text-neutral-500">
            {event.aiAnalysisDisabledReason}
          </p>
        ) : null}
        <InlineFormMessage
          message={formMessages[getAiAnalysisFormKey(event.id)]}
        />
      </form>

      <form className="mt-4 grid gap-2" onSubmit={onOpenCode}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="updateEventId" value={event.id} />
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#edf8ef] px-3 text-sm font-medium text-[#4fa75b] hover:bg-[#e4f3e7] disabled:opacity-60"
          disabled={isPending || event.newCommit === null}
          title={
            event.newCommit === null
              ? "У обновления нет известного коммита для открытия"
              : "Открыть код выбранного обновления в VS Code"
          }
        >
          <FileCode2 size={16} aria-hidden="true" />
          Открыть код
        </button>
        {event.newCommit === null ? (
          <p className="text-sm text-neutral-500">
            Нет известного коммита для открытия.
          </p>
        ) : null}
        <InlineFormMessage message={formMessages[getOpenCodeFormKey(event.id)]} />
      </form>

      <form className="mt-4 grid gap-2" onSubmit={onUpdateStatus}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="updateEventId" value={event.id} />
        <label
          className="text-xs font-medium uppercase text-neutral-400"
          htmlFor={`status-${event.id}`}
        >
          Статус проверки
        </label>
        <div className="flex flex-col gap-2 sm:flex-row xl:flex-col 2xl:flex-row">
          <select
            id={`status-${event.id}`}
            name="status"
            defaultValue={event.reviewStatus}
            className="min-h-10 flex-1 rounded-lg bg-white px-3 text-sm text-neutral-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline-none focus:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18)]"
            disabled={isPending}
          >
            {reviewStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            disabled={isPending}
          >
            <Save size={16} aria-hidden="true" />
            Статус
          </button>
        </div>
        <InlineFormMessage message={formMessages[getStatusFormKey(event.id)]} />
      </form>
    </section>
  );
}

function CommentsPanel({
  event,
  studentId,
  isPending,
  formMessages,
  onAddComment,
  onDeleteComment,
}: {
  event: UpdateEventListItem;
  studentId: string;
  isPending: boolean;
  formMessages: Record<string, StudentActionState | undefined>;
  onAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-lg bg-[#fbfbfa] p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold text-neutral-950">Комментарии</h4>
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-xs font-medium text-neutral-500">
          <MessageSquare size={14} aria-hidden="true" />
          {event.commentsCount}
        </span>
      </div>

      {event.comments.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {event.comments.map((comment) => (
            <article
              key={comment.id}
              className="flex items-start gap-3 rounded-lg bg-white px-3 py-2.5 text-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
            >
              <MessageSquare
                className="mt-0.5 shrink-0 text-neutral-400"
                size={16}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-neutral-400">
                  {formatDateTime(comment.createdAt)}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-neutral-900">
                  {comment.text}
                </p>
                <InlineFormMessage
                  message={formMessages[getDeleteCommentFormKey(comment.id)]}
                />
              </div>
              <form className="shrink-0" onSubmit={onDeleteComment}>
                <input type="hidden" name="studentId" value={studentId} />
                <input type="hidden" name="commentId" value={comment.id} />
                <input type="hidden" name="confirmed" value="true" />
                <button
                  type="submit"
                  className="inline-flex size-8 items-center justify-center rounded-full bg-[#fff1ed] text-[#d45b51] hover:bg-[#ffe8e1] disabled:opacity-60"
                  disabled={isPending}
                  title="Удалить комментарий"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span className="sr-only">Удалить комментарий</span>
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : null}

      <form className="mt-4 grid gap-2" onSubmit={onAddComment}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="updateEventId" value={event.id} />
        <input type="hidden" name="basedOnAiReportId" value="" />
        <label
          className="sr-only"
          htmlFor={`comment-${event.id}`}
        >
          Новый комментарий
        </label>
        <textarea
          id={`comment-${event.id}`}
          name="text"
          rows={2}
          className="min-h-20 resize-y rounded-lg bg-white p-3 text-sm text-neutral-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] outline-none focus:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18)]"
          placeholder="Новая заметка"
          disabled={isPending}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            disabled={isPending}
          >
            <Save size={16} aria-hidden="true" />
            Сохранить
          </button>
        </div>
        <InlineFormMessage message={formMessages[getAddCommentFormKey(event.id)]} />
      </form>
    </section>
  );
}

function AiReportsList({ event }: { event: UpdateEventListItem }) {
  const [primaryReport, ...olderReports] = event.aiReports;

  return (
    <section className="rounded-lg bg-[#fbfbfa] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-neutral-950">ИИ-рапорт</h4>
          <p className="mt-1 text-sm text-neutral-500">
            Последний рапорт показан как основной материал проверки.
          </p>
        </div>
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-xs font-medium text-neutral-500">
          <Bot size={14} aria-hidden="true" />
          {event.aiReportsCount}
        </span>
      </div>

      {primaryReport === undefined ? (
        <p className="mt-4 rounded-lg bg-white p-3 text-sm text-neutral-500 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
          ИИ-рапортов пока нет.
        </p>
      ) : (
        <>
          <AiReportCard report={primaryReport} variant="primary" />
          {olderReports.length > 0 ? (
            <details className="mt-4 rounded-lg bg-white p-3 text-sm text-neutral-600 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
              <summary className="cursor-pointer font-medium text-neutral-900">
                Старые ИИ-рапорты: {olderReports.length}
              </summary>
              <div className="mt-3 grid gap-3">
                {olderReports.map((report) => (
                  <AiReportCard
                    key={report.id}
                    report={report}
                    variant="secondary"
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function AiReportCard({
  report,
  variant,
}: {
  report: UpdateEventListItem["aiReports"][number];
  variant: "primary" | "secondary";
}) {
  return (
    <article
      className={[
        "mt-4 rounded-lg bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
        variant === "primary" ? "p-4" : "p-3",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={getAiReportTone(report.status)}>
          {formatAiReportStatus(report.status)}
        </StatusPill>
        <span className="text-xs text-neutral-500">
          {formatAiAnalysisMode(report.analysisMode)}
        </span>
        <span className="text-xs text-neutral-500">
          {formatDateTime(report.startedAt)}
        </span>
      </div>
      {report.summary ? (
        <p className="mt-3 text-sm font-medium text-neutral-900">
          {report.summary}
        </p>
      ) : null}
      {report.error ? (
        <p className="mt-3 rounded-lg bg-[#fff1ed] p-3 text-sm text-[#d45b51]">
          {report.error}
        </p>
      ) : null}
      {report.changes ? (
        <details className="mt-3 rounded-lg bg-[#fbfbfa] p-3 text-sm text-neutral-700">
          <summary className="cursor-pointer font-semibold text-neutral-950">
            Что добавлено
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words">
            {report.changes}
          </p>
        </details>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {report.risks.length > 0 ? (
          <CompactList title="Что быстро проверить" items={report.risks} />
        ) : null}
        {report.manualReviewQuestions.length > 0 ? (
          <CompactList
            title="Вопросы студенту"
            items={report.manualReviewQuestions}
          />
        ) : null}
      </div>
      {report.teacherCommentDraft ? (
        <div className="mt-3 rounded-lg bg-[#edf8ef] p-3 text-sm text-[#2f7438]">
          <p className="font-semibold">Черновик комментария</p>
          <p className="mt-2 whitespace-pre-wrap">
            {report.teacherCommentDraft}
          </p>
        </div>
      ) : null}
      <TechnicalReference report={report} />
      {report.fullText ? (
        <details className="mt-3 text-xs text-neutral-500">
          <summary className="cursor-pointer font-medium text-neutral-700">
            Полный текст рапорта
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words">
            {report.fullText}
          </p>
        </details>
      ) : null}
    </article>
  );
}

function TechnicalReference({
  report,
}: {
  report: UpdateEventListItem["aiReports"][number];
}) {
  const hasTechnicalReference =
    report.importantFiles.length > 0 ||
    report.pullRequestContext.status !== "not_requested" ||
    report.technicalDetails !== null;

  if (!hasTechnicalReference) {
    return null;
  }

  return (
    <details className="mt-3 rounded-lg bg-[#fbfbfa] p-3 text-xs text-neutral-500">
      <summary className="cursor-pointer font-medium text-neutral-700">
        Техническая справка
      </summary>
      <div className="mt-3 grid gap-2">
        <p>
          PR-контекст: {formatPullRequestContext(report.pullRequestContext)}
        </p>
        {report.importantFiles.length > 0 ? (
          <CompactList
            title="Файлы для углубления"
            items={report.importantFiles}
          />
        ) : null}
        {report.technicalDetails ? (
          <p className="whitespace-pre-wrap break-words">
            {report.technicalDetails}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function CompactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3 text-sm text-neutral-700">
      <p className="font-semibold text-neutral-900">{title}</p>
      <ul className="mt-1 grid gap-1">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineFormMessage({ message }: { message?: StudentActionState }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p
      className={[
        "rounded-lg px-3 py-2 text-sm",
        message.ok
          ? "bg-[#edf8ef] text-[#4fa75b]"
          : "bg-[#fff1ed] text-[#d45b51]",
      ].join(" ")}
    >
      {message.message}
    </p>
  );
}

type TechnicalRow = {
  label: string;
  value: string | null;
};

function TechnicalDetails({
  rows,
  summary = "Технические данные",
}: {
  rows: TechnicalRow[];
  summary?: string;
}) {
  const visibleRows = rows.filter(
    (row): row is { label: string; value: string } =>
      row.value !== null && row.value.length > 0,
  );

  if (visibleRows.length === 0) {
    return null;
  }

  return (
    <details className="mt-4 text-sm text-neutral-500">
      <summary className="cursor-pointer font-medium text-neutral-700">
        {summary}
      </summary>
      <dl className="mt-3 grid gap-2">
        {visibleRows.map((row) => (
          <div
            key={row.label}
            className="grid gap-1 rounded-lg bg-[#fbfbfa] px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3"
          >
            <dt className="text-xs font-medium uppercase text-neutral-400">
              {row.label}
            </dt>
            <dd className="break-words font-mono text-xs text-neutral-700">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

type Tone = "neutral" | "green" | "amber" | "red" | "blue";

function StatusPill({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  const classes: Record<Tone, string> = {
    neutral: "bg-[#f5f5f3] text-neutral-500",
    green: "bg-[#edf8ef] text-[#4fa75b]",
    amber: "bg-[#fff7e8] text-[#b87522]",
    red: "bg-[#fff1ed] text-[#d45b51]",
    blue: "bg-[#eef7ff] text-[#3e79ac]",
  };

  return (
    <span
      className={[
        "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        classes[tone],
      ].join(" ")}
    >
      {getToneIcon(tone)}
      {children}
    </span>
  );
}

function getToneIcon(tone: Tone) {
  if (tone === "green") {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }

  if (tone === "red") {
    return <AlertCircle size={14} aria-hidden="true" />;
  }

  if (tone === "blue") {
    return <RefreshCw size={14} aria-hidden="true" />;
  }

  return <Clock3 size={14} aria-hidden="true" />;
}

function getLabelTone(label: string): Tone {
  const normalized = label.toLowerCase();

  if (
    normalized.includes("ошиб") ||
    normalized.includes("недоступ") ||
    normalized.includes("повреж") ||
    normalized.includes("нет доступа")
  ) {
    return "red";
  }

  if (
    normalized.includes("не подключ") ||
    normalized.includes("не обнов") ||
    normalized.includes("ожид") ||
    normalized.includes("нужно")
  ) {
    return "amber";
  }

  if (
    normalized.includes("готов") ||
    normalized.includes("подключ") ||
    normalized.includes("обнов") ||
    normalized.includes("новые") ||
    normalized.includes("новых")
  ) {
    return "green";
  }

  return "neutral";
}

function getEventTone(status: UpdateEventListItem["status"]): Tone {
  if (status === "completed") {
    return "green";
  }

  if (status === "running") {
    return "blue";
  }

  if (status === "failed") {
    return "red";
  }

  return "amber";
}

function getReviewTone(status: UpdateEventListItem["reviewStatus"]): Tone {
  if (status === "reviewed") {
    return "green";
  }

  if (status === "in_review") {
    return "blue";
  }

  if (status === "needs_work") {
    return "red";
  }

  if (status === "needs_recheck") {
    return "amber";
  }

  return "neutral";
}

function getAiJobTone(
  status: NonNullable<UpdateEventListItem["aiAnalysisJob"]>["status"],
): Tone {
  if (status === "completed") {
    return "green";
  }

  if (status === "running" || status === "queued") {
    return "blue";
  }

  if (status === "failed" || status === "interrupted") {
    return "red";
  }

  return "neutral";
}

function getAiReportTone(
  status: UpdateEventListItem["aiReports"][number]["status"],
): Tone {
  if (status === "ready") {
    return "green";
  }

  if (status === "running") {
    return "blue";
  }

  return "red";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRepositoryLabel(value: string): string {
  try {
    const url = new URL(value);
    const [owner, repository] = url.pathname.split("/").filter(Boolean);

    if (owner && repository) {
      return `${owner}/${repository.replace(/\.git$/, "")}`;
    }
  } catch {
    return value;
  }

  return value;
}

function formatNewCommitsLabel(value: number | null): string {
  if (value === null) {
    return "Первое состояние проекта";
  }

  if (value === 0) {
    return "Без новых коммитов";
  }

  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${value} новый коммит`;
  }

  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) {
    return `${value} новых коммита`;
  }

  return `${value} новых коммитов`;
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

function formatAiReportStatus(
  status: UpdateEventListItem["aiReports"][number]["status"],
): string {
  if (status === "running") {
    return "выполняется";
  }

  if (status === "ready") {
    return "готов";
  }

  return "ошибка";
}

function formatAiAnalysisMode(
  mode: UpdateEventListItem["aiReports"][number]["analysisMode"],
): string {
  return mode === "current_state"
    ? "текущее состояние"
    : "изменения между коммитами";
}

function formatPullRequestContext(
  context: UpdateEventListItem["aiReports"][number]["pullRequestContext"],
): string {
  if (context.status === "found") {
    return context.number === null
      ? (context.title ?? "найден")
      : `#${context.number}${context.title ? ` ${context.title}` : ""}`;
  }

  if (context.status === "not_found") {
    return "не найден";
  }

  if (context.status === "unavailable") {
    return context.error ?? "недоступен";
  }

  return "не запрашивался";
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getStatusFormKey(updateEventId: string): string {
  return `status:${updateEventId}`;
}

function getAddCommentFormKey(updateEventId: string): string {
  return `add-comment:${updateEventId}`;
}

function getDeleteCommentFormKey(commentId: string): string {
  return `delete-comment:${commentId}`;
}

function getOpenCodeFormKey(updateEventId: string): string {
  return `open-code:${updateEventId}`;
}

function getAiAnalysisFormKey(updateEventId: string): string {
  return `ai-analysis:${updateEventId}`;
}

const reviewStatusOptions: Array<{
  value: UpdateEventListItem["reviewStatus"];
  label: string;
}> = [
  { value: "not_reviewed", label: "не проверено" },
  { value: "in_review", label: "проверяется" },
  { value: "reviewed", label: "проверено" },
  { value: "needs_work", label: "требует доработки" },
  { value: "needs_recheck", label: "требует повторной проверки" },
  { value: "skipped", label: "пропущено" },
];
