import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  ExternalLink,
  FileCode2,
  FileText,
  GitBranch,
  MessageSquare,
  Pencil,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

type Tone = "blue" | "green" | "red" | "amber" | "violet" | "neutral";

const attentionCards = [
  {
    title: "Новые изменения",
    subtitle: "Открыть студента и проверить последние коммиты.",
    label: "Нужно внимание",
    icon: <GitBranch size={18} aria-hidden="true" />,
    tone: "green" as const,
    className: "bg-[linear-gradient(135deg,#f1fbf3_0%,#d6f4dc_100%)]",
  },
  {
    title: "Первая загрузка",
    subtitle: "Посмотреть первое состояние проекта и при необходимости запустить ИИ.",
    label: "Первая проверка",
    icon: <Database size={18} aria-hidden="true" />,
    tone: "violet" as const,
    className: "bg-[linear-gradient(135deg,#fbf7ff_0%,#eadfff_100%)]",
  },
  {
    title: "Ошибка обновления",
    subtitle: "Показать причину рядом со студентом, не скрывая остальные результаты.",
    label: "Исправить",
    icon: <AlertCircle size={18} aria-hidden="true" />,
    tone: "red" as const,
    className: "bg-[linear-gradient(135deg,#fff7f4_0%,#ffe1d7_100%)]",
  },
  {
    title: "Нет GitHub-ссылки",
    subtitle: "Оставить студента в списке и дать короткое действие редактирования.",
    label: "Дополнить",
    icon: <ExternalLink size={18} aria-hidden="true" />,
    tone: "blue" as const,
    className: "bg-[linear-gradient(135deg,#f1f8ff_0%,#d8ecff_100%)]",
  },
];

const studentRows = [
  {
    student: "Марьям Халилова",
    note: "Личный проект",
    repository: "maryam/pilot-dashboard",
    status: "Есть новые изменения",
    statusTone: "green" as const,
    signal: "4 новых коммита",
    signalTone: "green" as const,
    lastEvent: "сегодня, 10:42",
  },
  {
    student: "Рашид Курбанов",
    note: "Первая неделя",
    repository: "rashid/course-app",
    status: "Впервые загружен",
    statusTone: "violet" as const,
    signal: "нужна первая проверка",
    signalTone: "violet" as const,
    lastEvent: "вчера, 18:10",
  },
  {
    student: "Лейла Ахмедова",
    note: "Приватный репозиторий",
    repository: "leyla/private-crm",
    status: "Ошибка обновления",
    statusTone: "red" as const,
    signal: "нет доступа",
    signalTone: "red" as const,
    lastEvent: "вчера, 17:55",
  },
  {
    student: "Саид Алиев",
    note: "Ждет ссылку",
    repository: "GitHub-ссылка не указана",
    status: "Проект не подключен",
    statusTone: "neutral" as const,
    signal: "нужно редактирование",
    signalTone: "amber" as const,
    lastEvent: "обновлений еще не было",
  },
];

const updateRows = [
  {
    result: "Новые изменения найдены",
    date: "14.05.2026, 10:42",
    status: "не проверено",
    statusTone: "amber" as const,
    commits: "4 новых коммита",
    reports: "1 ИИ-рапорт",
    comments: "2 комментария",
  },
  {
    result: "Обновление без изменений",
    date: "13.05.2026, 19:04",
    status: "проверено",
    statusTone: "green" as const,
    commits: "0 новых коммитов",
    reports: "ИИ не запускался",
    comments: "1 комментарий",
  },
  {
    result: "Первая загрузка проекта",
    date: "12.05.2026, 09:18",
    status: "требует доработки",
    statusTone: "red" as const,
    commits: "граница без старого коммита",
    reports: "2 ИИ-рапорта",
    comments: "3 комментария",
  },
];

const diagnosticRows = [
  {
    name: "Папка данных",
    value: "data/",
    status: "доступна",
    tone: "green" as const,
  },
  {
    name: "Git",
    value: "git --version",
    status: "готов",
    tone: "green" as const,
  },
  {
    name: "GitHub CLI",
    value: "gh auth status",
    status: "нужна проверка",
    tone: "amber" as const,
  },
  {
    name: "Codex CLI",
    value: "codex exec",
    status: "не найден",
    tone: "red" as const,
  },
  {
    name: "VS Code",
    value: "code",
    status: "готов",
    tone: "green" as const,
  },
];

const colorTokens = [
  { name: "Фон страницы", value: "#ffffff", className: "bg-white" },
  { name: "Поверхность", value: "#ffffff", className: "bg-white" },
  { name: "Разделитель", value: "#ebeae7", className: "bg-[#ebeae7]" },
  { name: "Основной текст", value: "#111111", className: "bg-neutral-950" },
  { name: "Подпись", value: "#8d8d89", className: "bg-[#8d8d89]" },
  { name: "Успех", value: "#4fa75b", className: "bg-[#4fa75b]" },
  { name: "Ошибка", value: "#d45b51", className: "bg-[#d45b51]" },
  { name: "ИИ", value: "#8d6ee8", className: "bg-[#8d6ee8]" },
];

const componentRows = [
  ["Бейдж уведомления", "иконка, короткий текст, мягкий фон без декоративных точек"],
  ["Строка студента", "имя, GitHub, статус проекта, последний сигнал, действия"],
  ["Строка обновления", "дата, результат, статус проверки, коммиты, ИИ и комментарии"],
  ["Рабочая область проверки", "ИИ-рапорт, комментарии и действия выбранного обновления"],
  ["Диагностика", "локальные пути и инструменты с понятным статусом"],
];

export function DesignMapPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="mx-auto grid max-w-[1220px] gap-10 px-5 py-8 md:px-8 lg:py-10">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-sm font-medium text-neutral-400">
              Внутренняя дизайн-карта
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
              Элементы Pilot Tracker
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-500">
              Карта фиксирует только реальные поверхности первой версии:
              студенты, обновления, проверка, ИИ-рапорты, комментарии,
              настройки и системные состояния.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-neutral-400">Фокус:</span>
            <SoftChip icon={<Sparkles size={15} aria-hidden="true" />} tone="green">
              Без лишних метрик
            </SoftChip>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-medium text-neutral-800 shadow-[0_4px_18px_rgba(0,0,0,0.06)]">
              Только первая версия
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="grid gap-5">
          <SectionHeader
            title="Сигналы списка студентов"
            subtitle="Вместо прогресса студента показываем то, что реально помогает выбрать следующую проверку."
            tool={<SoftChip icon={<UserRound size={15} aria-hidden="true" />} tone="green">Главный экран</SoftChip>}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {attentionCards.map((card) => (
              <article
                key={card.title}
                className={`min-h-32 rounded-lg p-5 shadow-[0_12px_34px_rgba(0,0,0,0.05)] ${card.className}`}
              >
                <NotificationBadge tone={card.tone} icon={card.icon}>
                  {card.label}
                </NotificationBadge>
                <h2 className="mt-5 text-lg font-semibold leading-6">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{card.subtitle}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          <SectionHeader
            title="Список студентов"
            subtitle="Компактная таблица без технической перегрузки: локальные пути и хеши остаются на странице студента."
            tool={
              <button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-neutral-800 shadow-[0_4px_18px_rgba(0,0,0,0.06)]">
                Обновить проекты
                <RefreshCw size={15} aria-hidden="true" />
              </button>
            }
          />
          <div className="overflow-hidden rounded-lg bg-white shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 text-sm font-medium text-neutral-400 max-lg:hidden">
              <span>Студент</span>
              <span>GitHub</span>
              <span>Статус проекта</span>
              <span>Последнее событие</span>
              <span />
            </div>
            {studentRows.map((row) => (
              <div
                key={row.student}
                className="grid gap-4 px-5 py-5 shadow-[0_-1px_0_rgba(0,0,0,0.06)] lg:grid-cols-[1.1fr_1fr_1fr_1fr_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium">{row.student}</p>
                  <p className="mt-1 text-sm text-neutral-400">{row.note}</p>
                </div>
                <p className="min-w-0 truncate text-sm text-neutral-600">
                  {row.repository}
                </p>
                <StatusLabel tone={row.statusTone}>{row.status}</StatusLabel>
                <div className="grid gap-2">
                  <NotificationBadge tone={row.signalTone} icon={getToneIcon(row.signalTone)}>
                    {row.signal}
                  </NotificationBadge>
                  <p className="text-sm text-neutral-400">{row.lastEvent}</p>
                </div>
                <div className="flex gap-2 lg:justify-end">
                  <IconButton title="Открыть студента">
                    <ArrowRight size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton title="Редактировать студента">
                    <Pencil size={16} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <SectionHeader
              compact
              title="Страница студента"
              subtitle="Верхний контекст помогает сориентироваться, но основная работа остается в ленте обновлений."
              tool={<SoftChip icon={<FileText size={15} aria-hidden="true" />} tone="neutral">Лента</SoftChip>}
            />
            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 py-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)] first:pt-0 first:shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Проект студента</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      GitHub, локальная копия, ветка main, последний коммит.
                    </p>
                  </div>
                  <NotificationBadge tone="green" icon={<CheckCircle2 size={15} aria-hidden="true" />}>
                    проект доступен
                  </NotificationBadge>
                </div>
              </div>
              <div className="grid gap-3 py-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)]">
                <p className="font-semibold">ИИ-описание проекта</p>
                <p className="text-sm leading-6 text-neutral-500">
                  Короткое резюме показывается, если оно уже создано вручную
                  через ИИ-анализ. Отсутствие описания не блокирует проверку.
                </p>
              </div>
              <div className="grid gap-3 py-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)]">
                <p className="font-semibold">Одиночное обновление</p>
                <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white">
                  Обновить проект
                  <RefreshCw size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <SectionHeader
              compact
              title="Карточки обновлений"
              subtitle="Каждое обновление остается компактной строкой истории и открывается в рабочую область проверки."
            />
            <div className="mt-5">
              {updateRows.map((row) => (
                <div
                  key={row.date}
                  className="grid gap-4 py-5 shadow-[0_-1px_0_rgba(0,0,0,0.06)] first:pt-0 first:shadow-none xl:grid-cols-[1.1fr_0.8fr_auto] xl:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium">{row.result}</p>
                      <StatusLabel tone={row.statusTone}>{row.status}</StatusLabel>
                    </div>
                    <p className="mt-2 text-sm text-neutral-400">{row.date}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <NotificationBadge tone="blue" icon={<GitBranch size={15} aria-hidden="true" />}>
                      {row.commits}
                    </NotificationBadge>
                    <NotificationBadge tone="violet" icon={<Bot size={15} aria-hidden="true" />}>
                      {row.reports}
                    </NotificationBadge>
                    <NotificationBadge tone="neutral" icon={<MessageSquare size={15} aria-hidden="true" />}>
                      {row.comments}
                    </NotificationBadge>
                  </div>
                  <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#fbfbfa] px-4 text-sm font-medium text-neutral-800">
                    Открыть
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          <SectionHeader
            title="Рабочая область проверки"
            subtitle="Не боковая карточка внутри карточки, а широкое место для выбранного обновления."
            tool={<SoftChip icon={<Bot size={15} aria-hidden="true" />} tone="green">ИИ вручную</SoftChip>}
          />
          <div className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[#ebeae7] pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold">Новые изменения найдены</h2>
                  <StatusLabel tone="amber">не проверено</StatusLabel>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Ветка main, старый коммит a18f24c, новый коммит 91c0b77,
                  4 новых коммита. Данные относятся только к выбранному обновлению.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex min-h-10 items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white">
                  Запустить ИИ
                  <Bot size={15} aria-hidden="true" />
                </button>
                <button className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#eef8ef] px-4 text-sm font-medium text-[#4fa75b]">
                  Открыть код
                  <FileCode2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid gap-8 pt-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section>
                <div className="flex items-center gap-3">
                  <Bot size={18} aria-hidden="true" className="text-[#8d6ee8]" />
                  <h3 className="text-lg font-semibold">Основной ИИ-рапорт</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  Рапорт объясняет человеческим языком, что студент добавил,
                  что стоит быстро проверить руками и какие вопросы можно задать.
                  Техническая справка остается вторичной и раскрывается отдельно.
                </p>
                <div className="mt-5 grid gap-3">
                  <CheckLine>проверить авторизацию и пустые состояния</CheckLine>
                  <CheckLine>сравнить новый экран с предыдущим коммитом</CheckLine>
                  <CheckLine>использовать черновик только как основу комментария</CheckLine>
                </div>
              </section>

              <section className="lg:border-l lg:border-[#ebeae7] lg:pl-8">
                <div className="flex items-center gap-3">
                  <MessageSquare size={18} aria-hidden="true" className="text-[#4f89c7]" />
                  <h3 className="text-lg font-semibold">Комментарии преподавателя</h3>
                </div>
                <div className="mt-4 grid gap-4">
                  <p className="text-sm leading-6 text-neutral-600">
                    Комментарии относятся ко всему обновлению, не к строкам diff
                    и не публикуются в GitHub автоматически.
                  </p>
                  <label className="grid gap-2 text-sm font-medium text-neutral-700">
                    Новый комментарий
                    <textarea
                      className="min-h-24 rounded-lg border-0 bg-[#f7f7f5] px-3 py-2 text-neutral-950 outline-none ring-1 ring-[#ebeae7] focus:ring-[#4fa75b]"
                      defaultValue="Проверить вручную сценарий сохранения после обновления."
                    />
                  </label>
                  <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white">
                    Сохранить комментарий
                    <MessageSquare size={15} aria-hidden="true" />
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <SectionHeader
              compact
              title="Настройки и диагностика"
              subtitle="Служебная зона остается спокойной: статус, команда, короткое объяснение."
              tool={<SoftChip icon={<Settings size={15} aria-hidden="true" />} tone="neutral">Локально</SoftChip>}
            />
            <div className="mt-5 grid grid-cols-[1fr_1fr_0.8fr] gap-4 py-3 text-sm font-medium text-neutral-400 max-md:hidden">
              <span>Элемент</span>
              <span>Значение</span>
              <span>Статус</span>
            </div>
            {diagnosticRows.map((row) => (
              <div
                key={row.name}
                className="grid gap-3 py-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)] md:grid-cols-[1fr_1fr_0.8fr] md:items-center"
              >
                <p className="font-medium">{row.name}</p>
                <p className="break-all font-mono text-sm text-neutral-500">{row.value}</p>
                <StatusLabel tone={row.tone}>{row.status}</StatusLabel>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <SectionHeader
              compact
              title="Формы и уведомления"
              subtitle="Короткие формы, уведомления рядом с действием и подтверждение удаления без лишнего слоя интерфейса."
            />
            <div className="mt-5 grid gap-5">
              <label className="grid gap-2 text-sm font-medium text-neutral-700">
                Имя студента
                <input
                  className="min-h-11 rounded-lg border-0 bg-[#f7f7f5] px-3 text-neutral-950 outline-none ring-1 ring-[#ebeae7] focus:ring-[#4fa75b]"
                  defaultValue="Марьям Халилова"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-neutral-700">
                GitHub-репозиторий
                <input
                  className="min-h-11 rounded-lg border-0 bg-[#f7f7f5] px-3 text-neutral-950 outline-none ring-1 ring-[#ebeae7] focus:ring-[#4fa75b]"
                  defaultValue="https://github.com/maryam/pilot-dashboard"
                />
              </label>
              <div className="grid gap-3">
                <NotificationStrip tone="green" icon={<CheckCircle2 size={18} aria-hidden="true" />}>
                  Студент сохранен. Список обновлен.
                </NotificationStrip>
                <NotificationStrip tone="red" icon={<AlertCircle size={18} aria-hidden="true" />}>
                  GitHub-ссылка должна выглядеть как ссылка на репозиторий.
                </NotificationStrip>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#fff8f5] px-4 py-3 text-sm text-[#91311f]">
                  <span className="inline-flex items-center gap-2">
                    <Trash2 size={17} aria-hidden="true" />
                    Удаление удалит историю, комментарии и ИИ-рапорты студента.
                  </span>
                  <button className="inline-flex min-h-9 items-center rounded-full bg-white px-3 font-medium text-[#91311f] shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                    Подтвердить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <SectionHeader
              compact
              title="Цвета"
              subtitle="Цвет служит сигналом состояния. Основной интерфейс остается светлым и спокойным."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {colorTokens.map((token) => (
                <div key={token.name} className="flex items-center gap-3">
                  <span className={`size-9 rounded-lg ${token.className} shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]`} />
                  <span>
                    <span className="block text-sm font-medium">{token.name}</span>
                    <span className="block text-xs text-neutral-400">
                      {token.value}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)]">
            <SectionHeader
              compact
              title="Компоненты"
              subtitle="Этот набор переносится в рабочие экраны без добавления новых продуктовых возможностей."
            />
            <div className="mt-5">
              {componentRows.map(([name, description]) => (
                <div
                  key={name}
                  className="grid gap-2 py-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)] first:pt-0 first:shadow-none md:grid-cols-[13rem_1fr]"
                >
                  <p className="font-medium">{name}</p>
                  <p className="text-sm leading-6 text-neutral-500">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  subtitle,
  tool,
  compact = false,
}: {
  title: string;
  subtitle: string;
  tool?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        compact ? "" : "mb-1",
      ].join(" ")}
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
          {subtitle}
        </p>
      </div>
      {tool ? <div className="shrink-0">{tool}</div> : null}
    </div>
  );
}

function SoftChip({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: "green" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "green"
      ? "bg-[#edf8ef] text-[#4fa75b]"
      : "bg-[#f5f5f3] text-neutral-500";

  return (
    <span
      className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-medium ${toneClass}`}
    >
      {icon}
      {children}
    </span>
  );
}

function NotificationBadge({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex min-h-8 max-w-full items-center gap-2 rounded-full px-3 text-sm font-medium ${getToneClasses(tone)}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function NotificationStrip({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${getToneClasses(tone)}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function StatusLabel({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${getToneText(tone)}`}>
      {getToneIcon(tone)}
      {children}
    </span>
  );
}

function IconButton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      className="inline-flex size-10 items-center justify-center rounded-full bg-[#fbfbfa] text-neutral-700 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] hover:bg-white"
      title={title}
      type="button"
    >
      {children}
      <span className="sr-only">{title}</span>
    </button>
  );
}

function CheckLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-3 text-sm text-neutral-600">
      <CheckCircle2
        className="mt-0.5 shrink-0 text-[#4fa75b]"
        size={17}
        aria-hidden="true"
      />
      <span>{children}</span>
    </p>
  );
}

function getToneClasses(tone: Tone): string {
  const classes: Record<Tone, string> = {
    blue: "bg-[#eef7ff] text-[#3e79ac]",
    green: "bg-[#edf8ef] text-[#4fa75b]",
    red: "bg-[#fff1ed] text-[#d45b51]",
    amber: "bg-[#fff7e8] text-[#b87522]",
    violet: "bg-[#f4efff] text-[#8062d6]",
    neutral: "bg-[#f5f5f3] text-neutral-500",
  };

  return classes[tone];
}

function getToneText(tone: Tone): string {
  const classes: Record<Tone, string> = {
    blue: "text-[#3e79ac]",
    green: "text-[#4fa75b]",
    red: "text-[#d45b51]",
    amber: "text-[#b87522]",
    violet: "text-[#8062d6]",
    neutral: "text-neutral-500",
  };

  return classes[tone];
}

function getToneIcon(tone: Tone): ReactNode {
  const icons: Record<Tone, ReactNode> = {
    blue: <ExternalLink size={15} aria-hidden="true" />,
    green: <CheckCircle2 size={15} aria-hidden="true" />,
    red: <AlertCircle size={15} aria-hidden="true" />,
    amber: <Clock3 size={15} aria-hidden="true" />,
    violet: <Bot size={15} aria-hidden="true" />,
    neutral: <FileText size={15} aria-hidden="true" />,
  };

  return icons[tone];
}
