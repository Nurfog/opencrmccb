import { request } from "../api-client";

export const reportsApi = {
  pipeline: () =>
    request<{ stages: unknown[]; total_deals: number; total_value: number }>(
      "/api/v1/reports/pipeline"
    ),

  winLoss: () =>
    request<{
      won_count: number;
      lost_count: number;
      win_rate: number;
      loss_rate: number;
      won_value: number;
      lost_value: number;
      total_closed: number;
    }>("/api/v1/reports/win-loss"),
};
