export const backendUrl = process.env.DWH_API_URL || "http://localhost:8000";

export async function proxyJson(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}
