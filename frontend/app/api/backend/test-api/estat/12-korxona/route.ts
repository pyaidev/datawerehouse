import { proxyJson } from "../../../../../../lib/backend";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit") || "20";
  const skip = url.searchParams.get("skip") || "0";
  const path = "/test-api/estat/12-korxona?limit=" + encodeURIComponent(limit)
    + "&skip=" + encodeURIComponent(skip);
  return proxyJson(path);
}
