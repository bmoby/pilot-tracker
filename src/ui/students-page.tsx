"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  createStudentAction,
  deleteStudentAction,
  type StudentActionState,
  updateStudentAction,
  updateAllProjectsAction,
  enqueueLatestAiAnalysesAction,
} from "./students-actions";
import type { UpdateRunListItem } from "@/application/project-updates";
import type { StudentListItem } from "@/application/students";
import { AppShell } from "./app-shell";

type StudentsPageProps = {
  initialStudents: StudentListItem[];
  latestUpdateRun: UpdateRunListItem | null;
  aiAnalysisQueueCandidateCount: number;
  activeAiAnalysisJobsCount: number;
};

type FormMode =
  | {
      type: "create";
    }
  | {
      type: "edit";
      student: StudentListItem;
    };

export function StudentsPage({
  initialStudents,
  latestUpdateRun,
  aiAnalysisQueueCandidateCount,
  activeAiAnalysisJobsCount,
}: StudentsPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentListItem | null>(null);
  const [message, setMessage] = useState<StudentActionState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [openedUpdates, setOpenedUpdates] = useState<Record<string, string>>(
    readOpenedUpdates,
  );

  function handleSaved(result: StudentActionState) {
    if (result.ok) {
      setFormError(null);
      setMessage(result);
      setFormMode(null);
      setStudentToDelete(null);
      router.refresh();
      return;
    }

    setMessage(result);
  }

  function submitForm(formData: FormData) {
    startTransition(async () => {
      const result =
        formMode?.type === "edit"
          ? await updateStudentAction(formData)
          : await createStudentAction(formData);

      if (result.ok) {
        handleSaved(result);
        return;
      }

      setMessage(null);
      setFormError(result.message);
    });
  }

  function confirmDelete(studentId: string) {
    const formData = new FormData();
    formData.set("studentId", studentId);
    formData.set("confirmed", "true");

    startTransition(async () => {
      const result = await deleteStudentAction(formData);
      handleSaved(result);
    });
  }

  function updateProjects() {
    startTransition(async () => {
      const result = await updateAllProjectsAction();
      setFormError(null);
      setMessage(result);
      router.refresh();
    });
  }

  function enqueueAiAnalyses() {
    startTransition(async () => {
      const result = await enqueueLatestAiAnalysesAction();
      setFormError(null);
      setMessage(result);
      router.refresh();
    });
  }

  function markStudentOpened(student: StudentListItem) {
    const marker = getStudentUpdateMarker(student);

    if (marker === null) {
      return;
    }

    setOpenedUpdates((current) => {
      const next = {
        ...current,
        [student.studentId]: marker,
      };

      writeOpenedUpdates(next);
      return next;
    });
  }

  return (
    <AppShell activeSection="students">
      <section className="grid gap-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-400">Студенты</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-neutral-950">
              Рабочая когорта
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f7f7f5] px-4 text-sm font-medium text-neutral-800 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] hover:bg-[#f1f1ef] disabled:opacity-60"
              onClick={updateProjects}
              disabled={isPending || initialStudents.length === 0}
            >
              <RefreshCw size={18} aria-hidden="true" />
              {isPending ? "Обновление..." : "Обновить проекты"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#eef7ff] px-4 text-sm font-medium text-[#3e79ac] hover:bg-[#e4f0fb] disabled:opacity-60"
              onClick={enqueueAiAnalyses}
              disabled={isPending || aiAnalysisQueueCandidateCount === 0}
              title={
                aiAnalysisQueueCandidateCount === 0
                  ? "Нет последних обновлений, подходящих для ИИ-анализа"
                  : "Поставить подходящие последние обновления в очередь ИИ-анализа"
              }
            >
              <Bot size={18} aria-hidden="true" />
              ИИ в очередь
              {activeAiAnalysisJobsCount > 0 ? ` · ${activeAiAnalysisJobsCount}` : null}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white shadow-[0_10px_28px_rgba(0,0,0,0.12)] hover:bg-neutral-800 disabled:opacity-60"
              onClick={() => {
                setFormMode({ type: "create" });
                setMessage(null);
                setFormError(null);
              }}
              disabled={isPending}
            >
              <Plus size={18} aria-hidden="true" />
              Добавить студента
            </button>
          </div>
        </div>

        {message ? (
          <Notice ok={message.ok}>{message.message}</Notice>
        ) : null}

        {latestUpdateRun ? <UpdateRunSummary run={latestUpdateRun} /> : null}

        {initialStudents.length === 0 ? (
          <section className="rounded-lg bg-white p-8 text-center shadow-[0_16px_42px_rgba(0,0,0,0.06)]">
            <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-[#f7f7f5] text-neutral-500">
              <UserRound size={24} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-neutral-950">
              Список студентов пуст
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">
              Добавьте первого студента, чтобы начать формировать текущую рабочую когорту.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg bg-white shadow-[0_16px_42px_rgba(0,0,0,0.06)]">
            <div className="grid grid-cols-[1.2fr_1fr_1.2fr_auto] gap-4 px-5 py-4 text-sm font-medium text-neutral-400 max-lg:hidden">
              <span>Студент</span>
              <span>GitHub</span>
              <span>После обновления</span>
              <span />
            </div>
            {initialStudents.map((student) => (
              <StudentRow
                key={student.studentId}
                student={student}
                disabled={isPending}
                opened={isStudentUpdateOpened(student, openedUpdates)}
                onOpen={() => markStudentOpened(student)}
                onEdit={() => {
                  setFormMode({ type: "edit", student });
                  setMessage(null);
                  setFormError(null);
                }}
                onDelete={() => {
                  setStudentToDelete(student);
                  setMessage(null);
                }}
              />
            ))}
          </section>
        )}
      </section>

      {formMode ? (
        <StudentFormModal
          mode={formMode}
          errorMessage={formError}
          isPending={isPending}
          onClose={() => {
            setFormMode(null);
            setFormError(null);
          }}
          onClearError={() => setFormError(null)}
          onSubmit={submitForm}
        />
      ) : null}

      {studentToDelete ? (
        <DeleteModal
          student={studentToDelete}
          isPending={isPending}
          onCancel={() => setStudentToDelete(null)}
          onConfirm={() => confirmDelete(studentToDelete.studentId)}
        />
      ) : null}
    </AppShell>
  );
}

function UpdateRunSummary({ run }: { run: UpdateRunListItem }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-[#fbfbfa] px-4 py-3 text-sm text-neutral-600 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2 font-medium text-neutral-800">
        <Clock3 className="shrink-0 text-neutral-400" size={16} aria-hidden="true" />
        <span className="min-w-0">
          Последнее обновление: {formatDateTime(run.finishedAt ?? run.startedAt)}
          <span className="text-neutral-400">
            {" "}
            · {formatUpdateRunStatus(run.status)}
          </span>
        </span>
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1">
        <SummaryItem label="Первая загрузка" value={run.summary.projectsFirstLoaded} />
        <SummaryItem label="Новые изменения" value={run.summary.projectsWithChanges} />
        <SummaryItem label="Коммиты" value={run.summary.newCommitsTotal} />
        <SummaryItem label="Без изменений" value={run.summary.projectsWithoutChanges} />
        <SummaryItem label="Ошибки" value={run.summary.errorsTotal} />
        <SummaryItem label="Без ссылки" value={run.summary.studentsWithoutRepository} />
      </dl>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <dt className="text-neutral-400">{label}:</dt>
      <dd className="font-semibold text-neutral-950">{value}</dd>
    </div>
  );
}

function StudentRow({
  student,
  disabled,
  opened,
  onOpen,
  onEdit,
  onDelete,
}: {
  student: StudentListItem;
  disabled: boolean;
  opened: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const activity = getStudentActivity(student, opened);

  return (
    <article className="grid gap-4 px-5 py-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)] lg:grid-cols-[1.2fr_1fr_1.2fr_auto] lg:items-center">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-neutral-950">
          {student.displayName}
        </h2>
        {student.notes ? (
          <p className="mt-1 text-sm text-neutral-400">{student.notes}</p>
        ) : null}
      </div>

      <RepositoryLink url={student.repositoryUrl} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <span className="whitespace-nowrap">
            {student.lastUpdatedAt
              ? formatDateTime(student.lastUpdatedAt)
              : "обновлений еще не было"}
          </span>
          <span
            className={[
              "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
              activity.tone === "dark"
                ? "bg-neutral-950 text-white"
                : activity.tone === "green"
                  ? "bg-[#edf8ef] text-[#4fa75b]"
                  : activity.tone === "red"
                    ? "bg-[#fff1ed] text-[#d45b51]"
                    : "bg-[#f7f7f5] text-neutral-500",
            ].join(" ")}
          >
            {activity.icon}
            {activity.label}
          </span>
          {activity.seenLabel ? (
            <span className="text-xs font-medium text-neutral-400">
              {activity.seenLabel}
            </span>
          ) : null}
          {student.lastAiAnalysisJobStatusLabel ? (
            <span
              className={[
                "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
                getAiJobClassName(student.lastAiAnalysisJobStatus),
              ].join(" ")}
            >
              <Bot size={14} aria-hidden="true" />
              ИИ: {student.lastAiAnalysisJobStatusLabel}
            </span>
          ) : null}
        </div>
        {student.lastError ? (
          <span className="mt-2 inline-flex max-w-full items-start gap-2 rounded-lg bg-[#fff1ed] px-3 py-2 text-sm font-medium text-[#d45b51]">
            <AlertCircle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
            <span className="break-words">{student.lastError}</span>
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2 lg:justify-end">
        <Link
          href={`/students/${student.studentId}`}
          className="inline-flex size-10 items-center justify-center rounded-full bg-[#fbfbfa] text-neutral-700 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] hover:bg-white"
          onClick={onOpen}
          title="Открыть студента"
        >
          <ArrowRight size={17} aria-hidden="true" />
          <span className="sr-only">Открыть студента</span>
        </Link>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full bg-[#fbfbfa] text-neutral-700 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] hover:bg-white disabled:opacity-60"
          onClick={onEdit}
          disabled={disabled}
          title="Редактировать студента"
        >
          <Pencil size={17} aria-hidden="true" />
          <span className="sr-only">Редактировать студента</span>
        </button>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full bg-[#fff1ed] text-[#d45b51] hover:bg-[#ffe7df] disabled:opacity-60"
          onClick={onDelete}
          disabled={disabled}
          title="Удалить студента"
        >
          <Trash2 size={17} aria-hidden="true" />
          <span className="sr-only">Удалить студента</span>
        </button>
      </div>
    </article>
  );
}

function RepositoryLink({ url }: { url: string | null }) {
  if (url === null) {
    return (
      <span className="inline-flex max-w-full min-w-0 items-center gap-2 text-sm font-medium text-neutral-400">
        <ExternalLink size={16} aria-hidden="true" />
        <span className="truncate">GitHub-ссылка не указана</span>
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full min-w-0 items-center gap-2 text-sm font-medium text-[#3e79ac] hover:underline"
      title={url}
    >
      <ExternalLink size={16} aria-hidden="true" />
      <span className="truncate">{formatRepositoryLabel(url)}</span>
    </a>
  );
}

type StudentActivity = {
  label: string;
  seenLabel: string | null;
  tone: "dark" | "green" | "neutral" | "red";
  icon: ReactNode;
};

function getStudentActivity(
  student: StudentListItem,
  opened: boolean,
): StudentActivity {
  if (student.lastError) {
    return {
      label: "ошибка",
      seenLabel: null,
      tone: "red",
      icon: <AlertCircle size={14} aria-hidden="true" />,
    };
  }

  if (student.repositoryUrl === null) {
    return {
      label: "нет ссылки",
      seenLabel: null,
      tone: "neutral",
      icon: <ExternalLink size={14} aria-hidden="true" />,
    };
  }

  if (student.lastNewCommitsCount !== null) {
    if (student.lastNewCommitsCount > 0) {
      return {
        label: formatCommitsCount(student.lastNewCommitsCount),
        seenLabel: opened ? "открыто" : "к проверке",
        tone: opened ? "green" : "dark",
        icon: opened ? (
          <CheckCircle2 size={14} aria-hidden="true" />
        ) : (
          <ArrowRight size={14} aria-hidden="true" />
        ),
      };
    }

    return {
      label: "0 коммитов",
      seenLabel: "без изменений",
      tone: "neutral",
      icon: <CheckCircle2 size={14} aria-hidden="true" />,
    };
  }

  if (student.lastUpdateResult === "cloned") {
    return {
      label: "первое состояние",
      seenLabel: opened ? "открыто" : "к проверке",
      tone: opened ? "green" : "dark",
      icon: opened ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : (
        <ArrowRight size={14} aria-hidden="true" />
      ),
    };
  }

  if (student.lastUpdatedAt === null) {
    return {
      label: "нет обновлений",
      seenLabel: null,
      tone: "neutral",
      icon: <Clock3 size={14} aria-hidden="true" />,
    };
  }

  return {
    label: student.statusLabel,
    seenLabel: opened ? "открыто" : null,
    tone: opened ? "green" : "neutral",
    icon: opened ? (
      <CheckCircle2 size={14} aria-hidden="true" />
    ) : (
      <Clock3 size={14} aria-hidden="true" />
    ),
  };
}

function getStudentUpdateMarker(student: StudentListItem): string | null {
  return student.lastUpdatedAt;
}

function getAiJobClassName(status: StudentListItem["lastAiAnalysisJobStatus"]) {
  if (status === "completed") {
    return "bg-[#edf8ef] text-[#4fa75b]";
  }

  if (status === "queued" || status === "running") {
    return "bg-[#eef7ff] text-[#3e79ac]";
  }

  if (status === "failed" || status === "interrupted") {
    return "bg-[#fff1ed] text-[#d45b51]";
  }

  return "bg-[#f7f7f5] text-neutral-500";
}

function isStudentUpdateOpened(
  student: StudentListItem,
  openedUpdates: Record<string, string>,
): boolean {
  const marker = getStudentUpdateMarker(student);

  return marker !== null && openedUpdates[student.studentId] === marker;
}

function readOpenedUpdates(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(openedUpdatesStorageKey);
    const parsed = raw ? JSON.parse(raw) : {};

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
  } catch {
    return {};
  }

  return {};
}

function writeOpenedUpdates(value: Record<string, string>) {
  try {
    window.localStorage.setItem(openedUpdatesStorageKey, JSON.stringify(value));
  } catch {
    return;
  }
}

function formatCommitsCount(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${value} коммит`;
  }

  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) {
    return `${value} коммита`;
  }

  return `${value} коммитов`;
}

function Notice({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
        ok ? "bg-[#edf8ef] text-[#4fa75b]" : "bg-[#fff1ed] text-[#d45b51]",
      ].join(" ")}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      )}
      <p>{children}</p>
    </div>
  );
}

const openedUpdatesStorageKey = "pilot-tracker:opened-student-updates";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatUpdateRunStatus(status: UpdateRunListItem["status"]): string {
  switch (status) {
    case "running":
      return "выполняется";
    case "completed":
      return "завершено";
    case "completed_with_errors":
      return "завершено с ошибками";
    case "failed":
      return "завершилось неуспешно";
  }
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

function StudentFormModal({
  mode,
  errorMessage,
  isPending,
  onClose,
  onClearError,
  onSubmit,
}: {
  mode: FormMode;
  errorMessage: string | null;
  isPending: boolean;
  onClose: () => void;
  onClearError: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const student = mode.type === "edit" ? mode.student : null;
  const [displayName, setDisplayName] = useState(student?.displayName ?? "");
  const [notes, setNotes] = useState(student?.notes ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState(student?.repositoryUrl ?? "");

  return (
    <Modal onClose={onClose} title={student ? "Редактировать студента" : "Добавить студента"}>
      <form action={onSubmit} className="grid gap-4">
        {student ? <input type="hidden" name="studentId" value={student.studentId} /> : null}

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-lg bg-[#fff1ed] p-3 text-sm text-[#d45b51]">
            <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-neutral-700">
          Имя студента
          <input
            name="displayName"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              onClearError();
            }}
            className="min-h-11 rounded-lg border-0 bg-[#f7f7f5] px-3 text-neutral-950 outline-none ring-1 ring-[#ebeae7] focus:ring-[#4fa75b]"
            disabled={isPending}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-neutral-700">
          Дополнительная информация
          <textarea
            name="notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              onClearError();
            }}
            className="min-h-24 rounded-lg border-0 bg-[#f7f7f5] px-3 py-2 text-neutral-950 outline-none ring-1 ring-[#ebeae7] focus:ring-[#4fa75b]"
            disabled={isPending}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-neutral-700">
          GitHub-репозиторий
          <input
            name="repositoryUrl"
            value={repositoryUrl}
            onChange={(event) => {
              setRepositoryUrl(event.target.value);
              onClearError();
            }}
            className="min-h-11 rounded-lg border-0 bg-[#f7f7f5] px-3 text-neutral-950 outline-none ring-1 ring-[#ebeae7] focus:ring-[#4fa75b]"
            placeholder="https://github.com/owner/repository"
            disabled={isPending}
          />
        </label>

        {student ? (
          <p className="rounded-lg bg-[#fff7e8] p-3 text-sm text-[#b87522]">
            Изменение GitHub-ссылки повлияет на будущие обновления проекта.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="min-h-10 rounded-full bg-[#f7f7f5] px-4 text-sm font-medium text-neutral-700 hover:bg-[#f1f1ef]"
            onClick={onClose}
            disabled={isPending}
          >
            Отменить
          </button>
          <button
            type="submit"
            className="min-h-10 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteModal({
  student,
  isPending,
  onCancel,
  onConfirm,
}: {
  student: StudentListItem;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} title="Удалить студента">
      <div className="grid gap-4">
        <p className="text-sm text-neutral-700">
          Студент «{student.displayName}» будет удален из локальных данных приложения.
        </p>
        <p className="rounded-lg bg-[#fff7e8] p-3 text-sm text-[#b87522]">
          Физические папки репозиториев и review-копий не будут удалены.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="min-h-10 rounded-full bg-[#f7f7f5] px-4 text-sm font-medium text-neutral-700 hover:bg-[#f1f1ef]"
            onClick={onCancel}
            disabled={isPending}
          >
            Отменить
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#d45b51] px-4 text-sm font-medium text-white hover:bg-[#c74f45] disabled:opacity-60"
            onClick={onConfirm}
            disabled={isPending}
          >
            <Trash2 size={16} aria-hidden="true" />
            {isPending ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 px-4 py-6">
      <section className="w-full max-w-xl rounded-lg bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-neutral-950">{title}</h2>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full bg-[#f7f7f5] text-neutral-600 hover:bg-[#f1f1ef]"
            onClick={onClose}
            title="Закрыть"
          >
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Закрыть</span>
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
