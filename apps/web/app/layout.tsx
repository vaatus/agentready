import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AgentReady — public adversarial benchmark for AI agents",
  description:
    "We benchmark every famous open-source AI agent against OWASP ASI-2026 on AMD MI300X — and auto-fix the failures with formal verification, chaos engineering, and a live PR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-zinc-900 bg-black/40 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold tracking-tight">
                Agent<span className="text-amd">Ready</span>
              </span>
              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                Public Benchmark
              </span>
            </Link>
            <nav className="flex gap-6 text-sm text-zinc-400">
              <Link href="/" className="hover:text-zinc-100">
                Leaderboard
              </Link>
              <Link href="/about" className="hover:text-zinc-100">
                Methodology
              </Link>
              <a
                href="https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-100"
              >
                OWASP ASI-2026 ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mt-20 border-t border-zinc-900">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-zinc-500">
            Powered by AMD MI300X · Built for the AMD Developer Hackathon · MIT licensed
          </div>
        </footer>
      </body>
    </html>
  );
}
