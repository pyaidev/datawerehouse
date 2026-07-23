import { proxyJson } from "../../../../../../lib/backend";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const url = new URL(request.url);
  const query = new URLSearchParams();
  for (const key of ["limit", "dw_id", "version_id"]) {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const suffix = query.size ? `?${query.toString()}` : "";
  return proxyJson(`/delivery/runs/${encodeURIComponent(runId)}${suffix}`);
}