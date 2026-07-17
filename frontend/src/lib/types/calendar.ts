export interface CalendarEvent {
  id: string;
  user_id: string;
  provider: string;
  external_id?: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  attendees?: unknown;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
  updated_at: string;
}
