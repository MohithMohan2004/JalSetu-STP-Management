export interface Stp {
  stp_id: string;
  stp_name: string;
  latitude: number | null;
  longitude: number | null;
  technology?: string;
  total_capacity_mld?: number;
  current_load_mld?: number;
  available_capacity_mld?: number;
  treatment_cost_per_kl?: number;
  quality_grade?: string;
  distance_km?: number;
}

export interface CurrentUser {
  logged_in: boolean;
  name: string;
  first_name?: string;
  last_name?: string;
  role: string;
  email?: string;
  initials: string;
}

export interface OcemsReading {
  success: boolean;
  available: boolean;
  stp_id?: string;
  timestamp?: string | null;
  pH?: number | string | null;
  BOD?: number | string | null;
  COD?: number | string | null;
  TSS?: number | string | null;
  permissible_ranges?: Record<string, unknown>;
}
