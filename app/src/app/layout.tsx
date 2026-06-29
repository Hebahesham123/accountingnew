import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام المحاسبة",
  description: "نظام محاسبة متكامل — قيود يومية، شجرة حسابات، وتقارير مالية",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
