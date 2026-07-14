import { proxyJson } from "../../../../lib/backend";

export async function GET() {
  return proxyJson("/health");
}
