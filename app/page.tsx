import { listStudents } from "@/application/students";
import { StudentsPage } from "@/ui/students-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  const result = await listStudents();

  if (!result.ok) {
    return (
      <main className="min-h-screen px-5 py-6 md:px-8">
        <section className="mx-auto max-w-6xl rounded-lg border border-red-200 bg-white p-6 text-red-900">
          <p className="text-sm font-semibold">Данные не загружены</p>
          <h1 className="mt-2 text-2xl font-semibold">Не удалось открыть список студентов</h1>
          <p className="mt-3 text-sm text-red-800">{result.error.message}</p>
          {result.error.path ? (
            <p className="mt-3 text-xs text-red-700">Путь: {result.error.path}</p>
          ) : null}
        </section>
      </main>
    );
  }

  return <StudentsPage initialStudents={result.value.students} />;
}
