import Link from "next/link";
import { getStudentDetails } from "@/application/project-updates";
import { StudentDetailPage } from "@/ui/student-detail-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StudentPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function StudentPage({ params }: StudentPageProps) {
  const { studentId } = await params;
  const result = await getStudentDetails(studentId);

  if (!result.ok) {
    return (
      <main className="min-h-screen px-5 py-6 md:px-8">
        <section className="mx-auto max-w-6xl rounded-lg border border-red-200 bg-white p-6 text-red-900">
          <p className="text-sm font-semibold">Данные не загружены</p>
          <h1 className="mt-2 text-2xl font-semibold">Не удалось открыть студента</h1>
          <p className="mt-3 text-sm text-red-800">{result.error.message}</p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-10 items-center rounded-lg border border-red-200 px-4 text-sm font-medium text-red-900 hover:border-red-300"
          >
            Вернуться к списку студентов
          </Link>
        </section>
      </main>
    );
  }

  return <StudentDetailPage data={result.value} />;
}
