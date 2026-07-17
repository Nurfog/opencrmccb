import { request } from "../api-client";
import type { Pipeline, PipelineStage, PipelineWithStages, Profile, Branding } from "../types";

export const adminApi = {
  listPipelines: () =>
    request<PipelineWithStages[]>("/api/v1/pipelines"),

  createPipeline: (data: { name: string; slug: string; description?: string; entity_type?: string }) =>
    request<Pipeline>("/api/v1/admin/pipelines", { method: "POST", body: JSON.stringify(data) }),

  updatePipeline: (id: string, data: { name: string; slug: string; description?: string; entity_type?: string }) =>
    request<Pipeline>(`/api/v1/admin/pipelines/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deletePipeline: (id: string) =>
    request<void>(`/api/v1/admin/pipelines/${id}`, { method: "DELETE" }),

  createStage: (pipelineId: string, data: { name: string; position: number; color?: string; probability?: number }) =>
    request<PipelineStage>(`/api/v1/admin/pipelines/${pipelineId}/stages`, { method: "POST", body: JSON.stringify(data) }),

  deleteStage: (pipelineId: string, stageId: string) =>
    request<void>(`/api/v1/admin/pipelines/${pipelineId}/stages/${stageId}`, { method: "DELETE" }),

  listProfiles: () =>
    request<Profile[]>("/api/v1/admin/profiles"),

  createProfile: (data: { name: string; description?: string; permissions?: string[] }) =>
    request<Profile>("/api/v1/admin/profiles", { method: "POST", body: JSON.stringify(data) }),

  updateProfile: (id: string, data: { name: string; description?: string; permissions?: string[] }) =>
    request<Profile>(`/api/v1/admin/profiles/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getBranding: () =>
    request<Branding>("/api/v1/branding"),

  updateBranding: (data: Partial<Branding>) =>
    request<Branding>("/api/v1/admin/branding", { method: "PUT", body: JSON.stringify(data) }),
};
