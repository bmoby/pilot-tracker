"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileCode2,
  GitBranch,
  MessageSquare,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import type { StudentDetailsData, UpdateEventListItem } from "@/application/project-updates";
import { AppShell } from "./app-shell";
import {
  addReviewCommentAction,
  deleteReviewCommentAction,
  openUpdateCodeAction,
  type StudentActionState,
  updateReviewCommentAction,
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
  const [formMessages, setFormMessages] = useState<Record<string, StudentActionState | undefined>>({});
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

  function updateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const key = getEditCommentFormKey(getFormString(formData, "commentId"));
    clearFormMessage(key);

    startTransition(async () => {
      const result = await updateReviewCommentAction(formData);
      setScopedFormMessage(key, result);

      if (result.ok) {
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
        <UpdatesTimeline
          events={data.events}
          studentId={data.student.id}
          isPending={isPending}
          formMessages={formMessages}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
          onOpenCode={openCode}
          onUpdateComment={updateComment}
          onUpdateStatus={updateStatus}
        />
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

function UpdatesTimeline({
  events,
  studentId,
  isPending,
  formMessages,
  onAddComment,
  onDeleteComment,
  onOpenCode,
  onUpdateComment,
  onUpdateStatus,
}: {
  events: UpdateEventListItem[];
  studentId: string;
  isPending: boolean;
  formMessages: Record<string, StudentActionState | undefined>;
  onAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCode: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateComment: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateStatus: (event: FormEvent<HTMLFormElement>) => void;
}) {
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
        <UpdateEventCard
          key={event.id}
          event={event}
          studentId={studentId}
          isPending={isPending}
          formMessages={formMessages}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onOpenCode={onOpenCode}
          onUpdateComment={onUpdateComment}
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
  onOpenCode,
  onUpdateComment,
  onUpdateStatus,
}: {
  event: UpdateEventListItem;
  studentId: string;
  isPending: boolean;
  formMessages: Record<string, StudentActionState | undefined>;
  onAddComment: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteComment: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCode: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateComment: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateStatus: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-950">{event.resultLabel}</h3>
            <span className="inline-flex min-h-7 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700">
              {event.reviewStatusLabel}
            </span>
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700">
              <MessageSquare size={14} aria-hidden="true" />
              {event.commentsCount}
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

        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 lg:w-[28rem]">
          <summary className="cursor-pointer font-medium text-slate-900">Детали события</summary>
          <div className="mt-3 grid gap-2 border-b border-slate-200 pb-4">
            <p>Репозиторий: {event.repositoryUrlSnapshot ?? "не указан"}</p>
            <p>Локальный путь: {event.projectLocalPathSnapshot ?? "не сохранен"}</p>
            <p>Статус события: {formatEventStatus(event.status)}</p>
          </div>

          <form className="mt-4 grid gap-2" onSubmit={onOpenCode}>
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="updateEventId" value={event.id} />
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
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
              <p className="text-sm text-slate-500">Нет известного коммита для открытия.</p>
            ) : null}
            <InlineFormMessage message={formMessages[getOpenCodeFormKey(event.id)]} />
          </form>

          <form className="mt-4 grid gap-2" onSubmit={onUpdateStatus}>
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="updateEventId" value={event.id} />
            <label className="text-xs font-semibold uppercase text-slate-500" htmlFor={`status-${event.id}`}>
              Статус проверки
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                id={`status-${event.id}`}
                name="status"
                defaultValue={event.reviewStatus}
                className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-500"
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
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={isPending}
              >
                <Save size={16} aria-hidden="true" />
                Статус
              </button>
            </div>
            <InlineFormMessage message={formMessages[getStatusFormKey(event.id)]} />
          </form>

          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-slate-950">Комментарии</h4>
              <span className="text-xs text-slate-500">{event.commentsCount}</span>
            </div>

            <form className="grid gap-2" onSubmit={onAddComment}>
              <input type="hidden" name="studentId" value={studentId} />
              <input type="hidden" name="updateEventId" value={event.id} />
              <input type="hidden" name="basedOnAiReportId" value="" />
              <label className="text-xs font-semibold uppercase text-slate-500" htmlFor={`comment-${event.id}`}>
                Новый комментарий
              </label>
              <textarea
                id={`comment-${event.id}`}
                name="text"
                rows={3}
                className="min-h-24 resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-teal-500"
                placeholder="Комментарий по обновлению"
                disabled={isPending}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                  disabled={isPending}
                >
                  <Save size={16} aria-hidden="true" />
                  Сохранить
                </button>
              </div>
              <InlineFormMessage message={formMessages[getAddCommentFormKey(event.id)]} />
            </form>

            {event.comments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                Комментариев пока нет.
              </p>
            ) : (
              <div className="grid gap-3">
                {event.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <form className="grid gap-2" onSubmit={onUpdateComment}>
                      <input type="hidden" name="studentId" value={studentId} />
                      <input type="hidden" name="commentId" value={comment.id} />
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{formatDateTime(comment.createdAt)}</span>
                        {comment.updatedAt !== comment.createdAt ? (
                          <span>изменен {formatDateTime(comment.updatedAt)}</span>
                        ) : null}
                      </div>
                      <textarea
                        name="text"
                        rows={3}
                        defaultValue={comment.text}
                        className="min-h-24 resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-teal-500"
                        disabled={isPending}
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-slate-300 disabled:opacity-60"
                          disabled={isPending}
                        >
                          <Save size={16} aria-hidden="true" />
                          Сохранить
                        </button>
                      </div>
                      <InlineFormMessage message={formMessages[getEditCommentFormKey(comment.id)]} />
                    </form>
                    <form className="flex justify-end" onSubmit={onDeleteComment}>
                      <input type="hidden" name="studentId" value={studentId} />
                      <input type="hidden" name="commentId" value={comment.id} />
                      <input type="hidden" name="confirmed" value="true" />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:border-red-300 disabled:opacity-60"
                        disabled={isPending}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        Удалить
                      </button>
                    </form>
                    <InlineFormMessage message={formMessages[getDeleteCommentFormKey(comment.id)]} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}

function InlineFormMessage({ message }: { message?: StudentActionState }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p
      className={[
        "rounded-lg border px-3 py-2 text-sm",
        message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-900",
      ].join(" ")}
    >
      {message.message}
    </p>
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

function getEditCommentFormKey(commentId: string): string {
  return `edit-comment:${commentId}`;
}

function getDeleteCommentFormKey(commentId: string): string {
  return `delete-comment:${commentId}`;
}

function getOpenCodeFormKey(updateEventId: string): string {
  return `open-code:${updateEventId}`;
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
