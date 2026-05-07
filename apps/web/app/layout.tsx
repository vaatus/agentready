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
      <body className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(237,28,36,0.08)_0%,_transparent_60%)]">
        <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-black/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="font-mono text-lg font-bold tracking-tight">
                Agent<span className="text-amd">Ready</span>
              </span>
              <span className="rounded-full border border-amd/30 bg-amd/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-amd">
                Public Benchmark
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-zinc-400">
              <Link
                href="/"
                className="transition-colors hover:text-zinc-100"
              >
                Leaderboard
              </Link>
              <Link
                href="/scan"
                className="transition-colors hover:text-zinc-100"
              >
                Scan an agent
              </Link>
              <Link
                href="/about"
                className="transition-colors hover:text-zinc-100"
              >
                Methodology
              </Link>
              <a
                href="https://github.com/vaatus/agentready"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-zinc-100"
              >
                GitHub ↗
              </a>
              <a
                href="https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/"
                target="_blank"
                rel="noreferrer"
                className="hidden text-xs text-zinc-500 transition-colors hover:text-zinc-300 md:inline"
              >
                OWASP ASI-2026 ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mt-20 border-t border-zinc-900">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-zinc-500 md:flex-row">
            <div>
              Powered by{" "}
              <span className="font-semibold text-zinc-300">AMD Instinct™ MI300X</span> · Built for
              the AMD Developer Hackathon · MIT licensed
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://huggingface.co/vaatus/agentready-chaos-remediation-lora-v0"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300"
              >
                🤗 LoRA
              </a>
              <a
                href="https://huggingface.co/spaces/vaatus/agentready-judge-demo"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300"
              >
                🤗 Space
              </a>
              <a
                href="https://github.com/vaatus/agentready"
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-300"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
