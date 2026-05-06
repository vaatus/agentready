import Link from "next/link";

import type { LeaderboardEntry } from "@/lib/api";

function scoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score < 40) return "text-red-400";
  if (score < 70) return "text-yellow-400";
  return "text-emerald-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-zinc-900";
  if (score < 40) return "bg-red-950/60";
  if (score < 70) return "bg-yellow-950/40";
  return "bg-emerald-950/40";
}

export function LeaderboardTable({ rows }: { rows: LeaderboardEntry[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3">Framework</th>
            <th className="px-4 py-3 text-right">OWASP ASI-2026</th>
            <th className="px-4 py-3">Last scanned</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((row, i) => (
            <tr key={row.slug} className={`${scoreBg(row.overall_score)} hover:bg-zinc-900`}>
              <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/agent/${row.slug}`} className="font-semibold hover:text-amd">
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-400">{row.framework}</td>
              <td className={`px-4 py-3 text-right font-mono text-lg ${scoreColor(row.overall_score)}`}>
                {row.overall_score !== null ? row.overall_score.toFixed(1) : "—"}
              </td>
              <td className="px-4 py-3 text-zinc-500">
                {row.last_scored_at ? new Date(row.last_scored_at).toLocaleString() : "queued"}
              </td>
              <td className="px-4 py-3 text-right">
                <a
                  href={row.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-200"
                >
                  github ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
