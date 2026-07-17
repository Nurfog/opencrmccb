import { request, downloadFile } from "../api-client";
import type { Document } from "../types";

export const documentsApi = {
  list: (params?: {
    folder?: string;
    search?: string;
    mime_type?: string;
  }) => request<Document[]>("/api/v1/documents", { params }),

  upload: (formData: FormData) =>
    request<Document>("/api/v1/documents/upload", {
      method: "POST",
      body: formData,
    }),

  download: (id: string) => downloadFile(`/api/v1/documents/${id}/download`),

  delete: (id: string) =>
    request<void>(`/api/v1/documents/${id}`, { method: "DELETE" }),
};
