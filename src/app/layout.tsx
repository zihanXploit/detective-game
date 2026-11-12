import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Two Lanterns — a detective game for two",
  description: "A cooperative detective puzzle game. Each of you holds half the truth.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
