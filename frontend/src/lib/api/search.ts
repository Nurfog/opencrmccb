import { request } from "../api-client";
import type { SearchResult } from "../types";

export const searchApi = {
  search: (params: { q: string }) =>
    request<{ contacts: SearchResult[]; companies: SearchResult[]; deals: SearchResult[] }>(
      "/api/v1/search",
      { params }
    ),
};
