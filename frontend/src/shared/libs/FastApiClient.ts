/**
 * A shared utility client for Next.js to communicate with internal FastAPI microservices.
 * This ensures standard headers, timeout handling, and error formatting across all teams.
 */

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchFastAPI<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const baseUrl = process.env.FASTAPI_URL;
  if (!baseUrl) {
    throw new Error("FASTAPI_URL environment variable is missing.");
  }

  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        // Add shared internal auth headers here if necessary
        ...fetchOptions.headers,
      },
    });

    clearTimeout(id);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`FastAPI Request Timeout after ${timeoutMs}ms to ${endpoint}`);
    }
    throw error;
  }
}
