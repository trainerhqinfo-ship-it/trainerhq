export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { name: string; id?: string; created_at?: string; updated_at?: string };
        Update: { name?: string; updated_at?: string };
        Relationships: [];
      };
      gyms: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          branch_name: string | null;
          logo_url: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          phone: string | null;
          email: string | null;
          timezone: string;
          default_slot_duration: number;
          status: "active" | "suspended" | "trial";
          subscription_plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { name: string; organization_id?: string | null; branch_name?: string | null; logo_url?: string | null; address?: string | null; city?: string | null; state?: string | null; country?: string | null; phone?: string | null; email?: string | null; timezone?: string; default_slot_duration?: number; status?: "active" | "suspended" | "trial"; subscription_plan?: string; id?: string };
        Update: { name?: string; branch_name?: string | null; logo_url?: string | null; address?: string | null; city?: string | null; phone?: string | null; email?: string | null; status?: "active" | "suspended" | "trial"; updated_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          role: "super_admin" | "gym_manager" | "trainer";
          gym_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; role: "super_admin" | "gym_manager" | "trainer"; email?: string | null; first_name?: string | null; last_name?: string | null; avatar_url?: string | null; gym_id?: string | null };
        Update: { email?: string | null; first_name?: string | null; last_name?: string | null; avatar_url?: string | null; role?: "super_admin" | "gym_manager" | "trainer"; gym_id?: string | null; updated_at?: string };
        Relationships: [];
      };
      trainers: {
        Row: {
          id: string;
          gym_id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          gender: "male" | "female" | "other" | null;
          date_of_birth: string | null;
          profile_picture_url: string | null;
          profile_picture_path: string | null;
          bio: string | null;
          role_title: string;
          specializations: string[];
          certifications: string[];
          experience_years: number;
          skills: string[];
          joining_date: string;
          status: "active" | "on_leave" | "inactive";
          max_clients_per_slot: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { gym_id: string; first_name: string; last_name: string; user_id?: string | null; email?: string | null; phone?: string | null; gender?: "male" | "female" | "other" | null; date_of_birth?: string | null; profile_picture_url?: string | null; profile_picture_path?: string | null; bio?: string | null; role_title?: string; specializations?: string[]; certifications?: string[]; experience_years?: number; skills?: string[]; joining_date?: string; status?: "active" | "on_leave" | "inactive"; max_clients_per_slot?: number; id?: string };
        Update: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null; gender?: "male" | "female" | "other" | null; bio?: string | null; role_title?: string; specializations?: string[]; certifications?: string[]; experience_years?: number; skills?: string[]; joining_date?: string; status?: "active" | "on_leave" | "inactive"; max_clients_per_slot?: number; profile_picture_url?: string | null; profile_picture_path?: string | null; updated_at?: string };
        Relationships: [];
      };
      trainer_working_hours: {
        Row: {
          id: string;
          trainer_id: string;
          gym_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_working_day: boolean;
          break_start: string | null;
          break_end: string | null;
          created_at: string;
        };
        Insert: { trainer_id: string; gym_id: string; day_of_week: number; start_time: string; end_time: string; is_working_day?: boolean; break_start?: string | null; break_end?: string | null; id?: string };
        Update: { start_time?: string; end_time?: string; is_working_day?: boolean; break_start?: string | null; break_end?: string | null };
        Relationships: [];
      };
      trainer_leaves: {
        Row: {
          id: string;
          trainer_id: string;
          gym_id: string;
          leave_type: "leave" | "sick_leave" | "holiday" | "temporary_unavailable";
          start_date: string;
          end_date: string;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: { trainer_id: string; gym_id: string; start_date: string; end_date: string; leave_type?: "leave" | "sick_leave" | "holiday" | "temporary_unavailable"; reason?: string | null; created_by?: string | null; id?: string };
        Update: { start_date?: string; end_date?: string; leave_type?: "leave" | "sick_leave" | "holiday" | "temporary_unavailable"; reason?: string | null };
        Relationships: [];
      };
      trainer_commission_rules: {
        Row: {
          id: string;
          trainer_id: string;
          gym_id: string;
          commission_type: "percentage" | "fixed_per_session";
          commission_value: number;
          effective_from: string;
          effective_to: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: { trainer_id: string; gym_id: string; commission_type: "percentage" | "fixed_per_session"; commission_value: number; effective_from?: string; effective_to?: string | null; notes?: string | null; created_by?: string | null; id?: string };
        Update: { commission_type?: "percentage" | "fixed_per_session"; commission_value?: number; effective_from?: string; effective_to?: string | null; notes?: string | null };
        Relationships: [];
      };
      pt_clients: {
        Row: {
          id: string;
          gym_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          gender: "male" | "female" | "other" | null;
          profile_picture_url: string | null;
          goal: string | null;
          joining_date: string;
          pt_start_date: string | null;
          preferred_days: number[];
          preferred_time: string | null;
          status: "active" | "paused" | "completed" | "expired";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { gym_id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null; gender?: "male" | "female" | "other" | null; profile_picture_url?: string | null; goal?: string | null; joining_date?: string; pt_start_date?: string | null; preferred_days?: number[]; preferred_time?: string | null; status?: "active" | "paused" | "completed" | "expired"; notes?: string | null; id?: string };
        Update: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null; gender?: "male" | "female" | "other" | null; profile_picture_url?: string | null; goal?: string | null; joining_date?: string; pt_start_date?: string | null; preferred_days?: number[]; preferred_time?: string | null; status?: "active" | "paused" | "completed" | "expired"; notes?: string | null; updated_at?: string };
        Relationships: [];
      };
      pt_packages: {
        Row: {
          id: string;
          client_id: string;
          gym_id: string;
          package_name: string | null;
          total_sessions: number;
          package_value: number | null;
          amount_collected: number | null;
          start_date: string | null;
          end_date: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: { client_id: string; gym_id: string; total_sessions: number; package_name?: string | null; package_value?: number | null; amount_collected?: number | null; start_date?: string | null; end_date?: string | null; is_active?: boolean; id?: string };
        Update: { package_name?: string | null; total_sessions?: number; package_value?: number | null; amount_collected?: number | null; start_date?: string | null; end_date?: string | null; is_active?: boolean };
        Relationships: [];
      };
      pt_assignments: {
        Row: {
          id: string;
          gym_id: string;
          client_id: string;
          trainer_id: string;
          package_id: string | null;
          days_of_week: number[];
          preferred_time: string;
          start_date: string;
          end_date: string | null;
          total_sessions: number | null;
          notes: string | null;
          assigned_by: string | null;
          status: "active" | "paused" | "completed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: { gym_id: string; client_id: string; trainer_id: string; days_of_week: number[]; preferred_time: string; start_date: string; package_id?: string | null; end_date?: string | null; total_sessions?: number | null; notes?: string | null; assigned_by?: string | null; status?: "active" | "paused" | "completed" | "cancelled"; id?: string };
        Update: { trainer_id?: string; days_of_week?: number[]; preferred_time?: string; start_date?: string; end_date?: string | null; total_sessions?: number | null; notes?: string | null; status?: "active" | "paused" | "completed" | "cancelled"; updated_at?: string };
        Relationships: [];
      };
      pt_sessions: {
        Row: {
          id: string;
          gym_id: string;
          assignment_id: string | null;
          trainer_id: string;
          client_id: string;
          session_date: string;
          start_time: string;
          end_time: string;
          status: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled";
          notes: string | null;
          session_revenue: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { gym_id: string; trainer_id: string; client_id: string; session_date: string; start_time: string; end_time: string; assignment_id?: string | null; status?: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled"; notes?: string | null; session_revenue?: number | null; created_by?: string | null; id?: string };
        Update: { status?: "scheduled" | "completed" | "cancelled" | "no_show" | "rescheduled"; session_date?: string; start_time?: string; end_time?: string; notes?: string | null; session_revenue?: number | null; updated_at?: string };
        Relationships: [];
      };
      trainer_feedback: {
        Row: {
          id: string;
          gym_id: string;
          trainer_id: string;
          client_id: string;
          session_id: string | null;
          overall_rating: number | null;
          is_punctual: boolean | null;
          satisfied_with_progress: boolean | null;
          would_continue: boolean | null;
          written_feedback: string | null;
          is_flagged: boolean;
          manager_reviewed: boolean;
          created_at: string;
        };
        Insert: { gym_id: string; trainer_id: string; client_id: string; session_id?: string | null; overall_rating?: number | null; is_punctual?: boolean | null; satisfied_with_progress?: boolean | null; would_continue?: boolean | null; written_feedback?: string | null; is_flagged?: boolean; manager_reviewed?: boolean; id?: string };
        Update: { overall_rating?: number | null; is_punctual?: boolean | null; satisfied_with_progress?: boolean | null; would_continue?: boolean | null; written_feedback?: string | null; is_flagged?: boolean; manager_reviewed?: boolean };
        Relationships: [];
      };
      trainer_payouts: {
        Row: {
          id: string;
          gym_id: string;
          trainer_id: string;
          period_month: number;
          period_year: number;
          commission_rule_id: string | null;
          commission_type: string;
          commission_value: number;
          total_sessions: number;
          completed_sessions: number;
          eligible_revenue: number;
          calculated_payout: number;
          adjustments: number;
          adjustment_notes: string | null;
          final_payout: number;
          status: "draft" | "reviewed" | "approved" | "paid";
          approved_by: string | null;
          approved_at: string | null;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { gym_id: string; trainer_id: string; period_month: number; period_year: number; commission_type: string; commission_value: number; commission_rule_id?: string | null; total_sessions?: number; completed_sessions?: number; eligible_revenue?: number; calculated_payout?: number; adjustments?: number; adjustment_notes?: string | null; final_payout?: number; status?: "draft" | "reviewed" | "approved" | "paid"; id?: string };
        Update: { adjustments?: number; adjustment_notes?: string | null; final_payout?: number; status?: "draft" | "reviewed" | "approved" | "paid"; approved_by?: string | null; approved_at?: string | null; locked_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          gym_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: { action: string; entity_type: string; gym_id?: string | null; user_id?: string | null; entity_id?: string | null; old_values?: Json | null; new_values?: Json | null; id?: string };
        Update: { action?: string; entity_type?: string; old_values?: Json | null; new_values?: Json | null };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience type aliases
type Organizations = Database["public"]["Tables"]["organizations"];
type Gyms = Database["public"]["Tables"]["gyms"];
type Profiles = Database["public"]["Tables"]["profiles"];
type Trainers = Database["public"]["Tables"]["trainers"];
type TrainerWorkingHours = Database["public"]["Tables"]["trainer_working_hours"];
type TrainerLeaves = Database["public"]["Tables"]["trainer_leaves"];
type TrainerCommissionRules = Database["public"]["Tables"]["trainer_commission_rules"];
type PtClients = Database["public"]["Tables"]["pt_clients"];
type PtPackages = Database["public"]["Tables"]["pt_packages"];
type PtAssignments = Database["public"]["Tables"]["pt_assignments"];
type PtSessions = Database["public"]["Tables"]["pt_sessions"];
type TrainerFeedback = Database["public"]["Tables"]["trainer_feedback"];
type TrainerPayouts = Database["public"]["Tables"]["trainer_payouts"];
type AuditLogs = Database["public"]["Tables"]["audit_logs"];

// Export row types
export type Gym = Gyms["Row"];
export type Profile = Profiles["Row"];
export type Trainer = Trainers["Row"];
export type TrainerWorkingHour = TrainerWorkingHours["Row"];
export type TrainerLeave = TrainerLeaves["Row"];
export type TrainerCommissionRule = TrainerCommissionRules["Row"];
export type PtClient = PtClients["Row"];
export type PtPackage = PtPackages["Row"];
export type PtAssignment = PtAssignments["Row"];
export type PtSession = PtSessions["Row"];
export type TrainerFeedbackRow = TrainerFeedback["Row"];
export type TrainerPayout = TrainerPayouts["Row"];

// Extended types with relations
export type TrainerWithDetails = Trainer & {
  commission?: TrainerCommissionRule;
  working_hours?: TrainerWorkingHour[];
  active_clients?: number;
  completed_sessions_month?: number;
  avg_rating?: number;
};

export type PtClientWithDetails = PtClient & {
  trainer?: Trainer;
  package?: PtPackage;
  sessions_completed?: number;
  sessions_remaining?: number;
};
