import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { logger } from "./logger";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    logger.error(`API Error ${res.status}:`, text);
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  logger.debug(`API ${method}`, url, data);

  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  logger.debug(`API ${method} response:`, res.status, res.statusText);

  return res;
}

export const getQueryFn: <T>() => QueryFunction<T> =
  () =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;

    logger.debug('Query fetch:', url);

    const res = await fetch(url, {
      credentials: "include",
    });

    await throwIfResNotOk(res);
    const json = await res.json();

    logger.debug('Query response:', url, json);

    return json;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
