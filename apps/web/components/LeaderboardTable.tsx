import Link from "next/link";

import type { LeaderboardEntry } from "@/lib/api";

function scoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score < 60) return "text-red-400";
  if (score < 70) return "text-orange-400";
  if (score < 80) return "text-yellow-400";
  return "text-emerald-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "";
  if (score < 60) return "bg-red-950/30";
  if (score < 70) return "bg-orange-950/20";
  if (score < 80) return "bg-yellow-950/15";
  return "bg-emerald-950/25";
}

function rankAccent(i: number): string {
  if (i === 0) return "text-amd font-bold";
  if (i === 1) return "text-zinc-300 font-bold";
  if (i === 2) return "text-zinc-400 font-bold";
  return "text-zinc-600";
}

export function LeaderboardTable({ rows }: { rows: LeaderboardEntry[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 text-left text-[10px] uppercase tracking-[0.15em] text-zinc-500">
          <tr>
            <th className="px-4 py-3 w-12">#</th>
            <th className="px-4 py-3">Agent</th>
            <th className="px-4 py-3">Built on</th>
            <th className="px-4 py-3 text-right">Safety score / 100</th>
            <th className="px-4 py-3">Last tested</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {rows.map((row, i) => (
            <tr
              key={row.slug}
              className={`${scoreBg(row.overall_score)} transition-colors hover:bg-zinc-900/80`}
            >
              <td className={`px-4 py-3.5 font-mono ${rankAccent(i)}`}>
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="px-4 py-3.5">
                <Link
                  href={`/agent/${row.slug}`}
                  className="font-semibold transition-colors hover:text-amd"
                >
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-3.5 text-zinc-400">{row.framework}</td>
              <td className={`px-4 py-3.5 text-right font-mono text-xl tabular-nums ${scoreColor(row.overall_score)}`}>
                {row.overall_score !== null ? row.overall_score.toFixed(1) : "—"}
              </td>
              <td className="px-4 py-3.5 text-xs text-zinc-500">
                {row.last_scored_at
                  ? `${new Date(row.last_scored_at).toISOString().slice(0, 10)} UTC`
                  : "queued"}
              </td>
              <td className="px-4 py-3.5 text-right">
                <a
                  href={row.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
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
