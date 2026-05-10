import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pilot Tracker",
  description: "Локальный рабочий инструмент преподавателя для проверки студенческих проектов.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
