export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_id?: string;
  permissions: string[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
