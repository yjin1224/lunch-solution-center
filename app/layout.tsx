// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react"; // 👈 추가

export const metadata: Metadata = {
  title: "런치 솔루션 센터",
  description: "프러머들의 점심 고민을 해결하는 런치 솔루션 센터",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body className="bg-white">
        {children}
        <Analytics /> {/* 👈 Vercel Analytics 추가 */}
      </body>
    </html>
  );
}
