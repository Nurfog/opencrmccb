export interface Document {
  id: string;
  filename: string;
  original_name: string;
  mime_type?: string;
  file_size: number;
  folder?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}
