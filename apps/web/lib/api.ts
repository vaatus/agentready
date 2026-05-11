// Server components fetch the backend directly. Client components fetch
// `/api/*` and Next rewrites to the backend (no CORS, no env exposure).
const SERVER_API_URL = process.env.AGENTREADY_API_URL ?? "http://localhost:8000";
const API_URL = typeof window === "undefined" ? SERVER_API_URL : "/api";

export type LeaderboardEntry = {
  slug: string;
  name: string;
  github_url: string;
  framework: string;
  overall_score: number | null;
  last_scored_at: string | null;
};

export type AttackRecord = {
  category?: string;
  name?: string;
  seed_name?: string;
  payload?: string;
  plant?: string;
  trigger?: string;
  baseline_probe?: string;
  baseline_response?: string;
  post_attack_response?: string;
  altered?: boolean;
  confidence?: number;
  reasoning?: string;
  extra?: Record<string, unknown>;
};

export type AsiScore = {
  category: string;
  score: number;
  is_real: boolean;
  failed_attacks_count: number;
  passed_attacks_count: number;
  failed_attacks?: AttackRecord[];
  passed_attacks?: AttackRecord[];
};

export type ChaosCell = {
  epsilon: number;
  lambda_: number;
  pass_at_1: number;
  n_trials: number;
  is_real: boolean;
};

export type AgentReport = {
  slug: string;
  name: string;
  github_url: string;
  framework: string;
  stars: number;
  overall_score: number | null;
  last_scored_at: string | null;
  latest_scan: {
    id: string;
    z3_status: string | null;
    chaos_grade: string | null;
    started_at: string;
    completed_at: string | null;
  } | null;
  asi_scores: AsiScore[];
  worst_failure: Record<string, unknown> | null;
  chaos_cells: ChaosCell[];
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type RemediationBundle = {
  slug: string;
  scan_id: string;
  files: Record<string, string>;
  pr_title?: string;
  pr_body?: string;
  diff_preview?: string;
  // Backend started returning `categories_addressed`; older payloads used
  // `asi_categories_addressed`. Accept either; the UI normalizes via
  // `categoriesAddressed(bundle)` in RemediationPanel.
  categories_addressed?: string[];
  asi_categories_addressed?: string[];
  guard_rules?: Array<{ category: string; rule: string }>;
  patched_system_prompt?: string;
  pre_fix_score?: number | null;
  post_fix_score?: number | null;
  pre_fix_asi06_score?: number | null;
  post_fix_asi06_score?: number | null;
  z3_status?: string | null;
  github_url?: string | null;
  generated_at?: string;
  pr_url?: string | null;
  pr_title_normalized?: string;
  artifact_url_prefix: string;
};

export type ScanProgress = {
  scan_id: string;
  step: string;
  updated_at?: string;
  slug?: string;
  framework?: string;
  tools?: number;
  attacks_done?: number;
  attacks_total?: number;
  latest?: string;
  overall_score?: number;
  error?: string;
};

export async function startScan(githubUrl: string): Promise<{ scan_id: string; status: string }> {
  const res = await fetch(`${API_URL}/evaluate-async`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ github_url: githubUrl }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /evaluate-async → ${res.status} ${text}`);
  }
  return res.json();
}

export async function getScanStatus(scanId: string): Promise<ScanProgress> {
  const res = await fetch(`${API_URL}/scan/${encodeURIComponent(scanId)}/status`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET /scan/${scanId}/status → ${res.status}`);
  return res.json();
}

export async function runLiveChaos(slug: string): Promise<{ slug: string; cells: ChaosCell[]; grade: string }> {
  const res = await fetch(`${API_URL}/agent/${encodeURIComponent(slug)}/chaos/run-live`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`POST /chaos/run-live → ${res.status}`);
  return res.json();
}

export async function fetchLatestRemediation(slug: string): Promise<RemediationBundle | null> {
  const res = await fetch(`${API_URL}/agent/${encodeURIComponent(slug)}/remediation/latest`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API → ${res.status}`);
  return res.json() as Promise<RemediationBundle>;
}

export async function triggerRemediation(slug: string): Promise<RemediationBundle> {
  const res = await fetch(`${API_URL}/agent/${encodeURIComponent(slug)}/remediate`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`POST /remediate → ${res.status}`);
  return res.json() as Promise<RemediationBundle>;
}

export function artifactUrl(prefix: string, filename: string): string {
  return `${API_URL}${prefix}${filename}`;
}

export async function fetchLeaderboard(): Promise<{ agents: LeaderboardEntry[] }> {
  return getJson("/leaderboard");
}

export async function fetchAgent(slug: string): Promise<AgentReport> {
  return getJson(`/agent/${encodeURIComponent(slug)}`);
}
