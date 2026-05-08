"use client";

const KEY = "agentready:my-scans";

export type SavedScan = {
  scan_id: string;
  github_url: string;
  started_at: string;
  status?: string; // queued | running | completed | failed
  slug?: string | null;
  overall_score?: number | null;
  finished_at?: string;
};

export function loadMyScans(): SavedScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

export function saveMyScans(scans: SavedScan[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(scans));
  } catch {
    /* quota */
  }
}

export function upsertMyScan(scan: SavedScan): SavedScan[] {
  const all = loadMyScans();
  const idx = all.findIndex((s) => s.scan_id === scan.scan_id);
  if (idx >= 0) all[idx] = { ...all[idx], ...scan };
  else all.unshift(scan);
  // Cap at 30 entries.
  const trimmed = all.slice(0, 30);
  saveMyScans(trimmed);
  return trimmed;
}

export function removeMyScan(scanId: string): SavedScan[] {
  const all = loadMyScans().filter((s) => s.scan_id !== scanId);
  saveMyScans(all);
  return all;
}
