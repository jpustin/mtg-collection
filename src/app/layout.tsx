import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MTG Collection",
  description: "Manage your Magic: The Gathering card collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-zinc-900">
              MTG Collection
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="text-zinc-600 hover:text-zinc-900">
                Dashboard
              </Link>
              <Link href="/collections/new" className="text-zinc-600 hover:text-zinc-900">
                New Collection
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
