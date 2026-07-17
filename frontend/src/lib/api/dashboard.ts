import { request } from "../api-client";
import type { DashboardStats, PipelineStage, TopDeal, RecentActivity } from "../types";

export const dashboardApi = {
  stats: () =>
    request<DashboardStats>("/api/v1/dashboard/stats"),

  pipeline: () =>
    request<{ stages: PipelineStage[] }>("/api/v1/dashboard/pipeline"),

  topDeals: () =>
    request<{ deals: TopDeal[] }>("/api/v1/dashboard/top-deals"),

  recentActivities: () =>
    request<{ activities: RecentActivity[] }>("/api/v1/dashboard/recent-activities"),
};
