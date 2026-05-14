"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
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
} from "./students-actions";
import type { UpdateRunListItem } from "@/application/project-updates";
import type { StudentListItem } from "@/application/students";
import { AppShell } from "./app-shell";

type StudentsPageProps = {
  initialStudents: StudentListItem[];
  latestUpdateRun: UpdateRunListItem | null;
};

type FormMode =
  | {
      type: "create";
    }
  | {
      type: "edit";
      student: StudentListItem;
    };

export function StudentsPage({ initialStudents, latestUpdateRun }: StudentsPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<StudentListItem | null>(null);
  const [message, setMessage] = useState<StudentActionState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  return (
    <AppShell activeSection="students">
      <section className="grid gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">Студенты</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Рабочая когорта</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:border-slate-300 disabled:opacity-60"
              onClick={updateProjects}
              disabled={isPending || initialStudents.length === 0}
            >
              <RefreshCw size={18} aria-hidden="true" />
              {isPending ? "Обновление..." : "Обновить проекты"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
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

        {latestUpdateRun ? <UpdateRunSummary run={latestUpdateRun} /> : null}

        {initialStudents.length === 0 ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <UserRound size={24} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-950">Список студентов пуст</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Добавьте первого студента, чтобы начать формировать текущую рабочую когорту.
            </p>
          </section>
        ) : (
          <section className="grid gap-3">
            {initialStudents.map((student) => (
              <StudentRow
                key={student.studentId}
                student={student}
                disabled={isPending}
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
    <section className="flex flex-col gap-3 border-y border-slate-200 py-3 text-sm text-slate-700 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
        <Clock3 className="shrink-0 text-slate-500" size={16} aria-hidden="true" />
        <span className="min-w-0">
          Последнее обновление: {formatDateTime(run.finishedAt ?? run.startedAt)}
          <span className="text-slate-500">
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
      <dt className="text-slate-500">{label}:</dt>
      <dd className="font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function StudentRow({
  student,
  disabled,
  onEdit,
  onDelete,
}: {
  student: StudentListItem;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-950">{student.displayName}</h2>
            <StatusBadge status={student.statusLabel} />
          </div>

          {student.notes ? <p className="mt-2 text-sm text-slate-600">{student.notes}</p> : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
            <RepositoryLink url={student.repositoryUrl} />
            <InfoLine label={student.lastUpdatedAt ? `Обновлено: ${formatDateTime(student.lastUpdatedAt)}` : "Обновлений еще не было"} />
            {student.lastUpdateResultLabel ? (
              <InfoLine label={`Последнее событие: ${student.lastUpdateResultLabel}`} />
            ) : null}
            {student.lastNewCommitsCount !== null ? (
              <InfoLine label={`Новых коммитов: ${student.lastNewCommitsCount}`} />
            ) : null}
          </div>

          {student.lastError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {student.lastError}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          <Link
            href={`/students/${student.studentId}`}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:border-slate-300"
            title="Открыть студента"
          >
            <ArrowRight size={17} aria-hidden="true" />
            <span className="sr-only">Открыть студента</span>
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:border-slate-300 disabled:opacity-60"
            onClick={onEdit}
            disabled={disabled}
            title="Редактировать студента"
          >
            <Pencil size={17} aria-hidden="true" />
            <span className="sr-only">Редактировать студента</span>
          </button>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:border-red-300 disabled:opacity-60"
            onClick={onDelete}
            disabled={disabled}
            title="Удалить студента"
          >
            <Trash2 size={17} aria-hidden="true" />
            <span className="sr-only">Удалить студента</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function RepositoryLink({ url }: { url: string | null }) {
  if (url === null) {
    return (
      <span className="inline-flex max-w-full min-w-0 items-center gap-2 text-slate-500">
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
      className="inline-flex max-w-full min-w-0 items-center gap-2 font-medium text-teal-700 hover:text-teal-800 hover:underline"
      title={url}
    >
      <ExternalLink size={16} aria-hidden="true" />
      <span className="truncate">{formatRepositoryLabel(url)}</span>
    </a>
  );
}

function InfoLine({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <p className="flex max-w-full min-w-0 items-center gap-2 whitespace-nowrap">
      {icon ? <span className="text-slate-400">{icon}</span> : null}
      <span className="truncate">{label}</span>
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-xs font-medium text-teal-800">
      {status}
    </span>
  );
}

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
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-slate-800">
          Имя студента
          <input
            name="displayName"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              onClearError();
            }}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
            disabled={isPending}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-800">
          Дополнительная информация
          <textarea
            name="notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              onClearError();
            }}
            className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-700"
            disabled={isPending}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-800">
          GitHub-репозиторий
          <input
            name="repositoryUrl"
            value={repositoryUrl}
            onChange={(event) => {
              setRepositoryUrl(event.target.value);
              onClearError();
            }}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
            placeholder="https://github.com/owner/repository"
            disabled={isPending}
          />
        </label>

        {student ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Изменение GitHub-ссылки повлияет на будущие обновления проекта.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:border-slate-300"
            onClick={onClose}
            disabled={isPending}
          >
            Отменить
          </button>
          <button
            type="submit"
            className="min-h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
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
        <p className="text-sm text-slate-700">
          Студент «{student.displayName}» будет удален из локальных данных приложения.
        </p>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Физические папки репозиториев и review-копий не будут удалены.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:border-slate-300"
            onClick={onCancel}
            disabled={isPending}
          >
            Отменить
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300"
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
