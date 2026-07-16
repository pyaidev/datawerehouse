import { proxyJson } from "../../../../../lib/backend";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit") || "20";
  const skip = url.searchParams.get("skip") || "0";
  return proxyJson(`/test-api/products-null?limit=${encodeURIComponent(limit)}&skip=${encodeURIComponent(skip)}`);
}

