import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simplifica Contas",
  description: "Sua vida financeira organizada de um jeito simples, visual e sem complicação.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
