import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.AGENTREADY_API_URL ?? "http://localhost:8000";

async function proxy(req: Request, ctx: { params: { path: string[] } }) {
  const path = (ctx.params.path ?? []).map(encodeURIComponent).join("/");
  const search = new URL(req.url).search;
  const target = `${API_URL}/${path}${search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const respHeaders = new Headers(upstream.headers);
    respHeaders.delete("content-encoding");
    respHeaders.delete("transfer-encoding");
    return new NextResponse(body, { status: upstream.status, headers: respHeaders });
  } catch (e) {
    return NextResponse.json(
      { error: "proxy failed", detail: e instanceof Error ? e.message : String(e), target },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
