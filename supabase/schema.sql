-- ============================================================
-- TRAINERHQ DATABASE SCHEMA
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS (future multi-branch parent)
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GYMS (one per tenant / branch)
-- ============================================================
CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  branch_name TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  phone TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  default_slot_duration INTEGER DEFAULT 60, -- minutes
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
  subscription_plan TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'gym_manager', 'trainer')),
  gym_id UUID REFERENCES gyms(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAINERS
-- ============================================================
CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id), -- for trainer login
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE,
  profile_picture_url TEXT,
  profile_picture_path TEXT,
  bio TEXT,
  role_title TEXT DEFAULT 'Personal Trainer',
  specializations TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,
  skills TEXT[] DEFAULT '{}',
  joining_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'inactive')),
  max_clients_per_slot INTEGER DEFAULT 2 CHECK (max_clients_per_slot >= 1 AND max_clients_per_slot <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAINER WORKING HOURS
-- ============================================================
CREATE TABLE trainer_working_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_working_day BOOLEAN DEFAULT TRUE,
  break_start TIME,
  break_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, day_of_week)
);

-- ============================================================
-- TRAINER LEAVES
-- ============================================================
CREATE TABLE trainer_leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  leave_type TEXT DEFAULT 'leave' CHECK (leave_type IN ('leave', 'sick_leave', 'holiday', 'temporary_unavailable')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAINER BLOCKED SLOTS
-- ============================================================
CREATE TABLE trainer_blocked_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAINER COMMISSION RULES (versioned / historical)
-- ============================================================
CREATE TABLE trainer_commission_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed_per_session')),
  commission_value NUMERIC(10,2) NOT NULL, -- % or fixed INR amount
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL = currently active
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PT CLIENTS
-- ============================================================
CREATE TABLE pt_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  profile_picture_url TEXT,
  goal TEXT,
  joining_date DATE DEFAULT CURRENT_DATE,
  pt_start_date DATE,
  preferred_days INTEGER[] DEFAULT '{}', -- day_of_week
  preferred_time TIME,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PT PACKAGES
-- ============================================================
CREATE TABLE pt_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES pt_clients(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  package_name TEXT,
  total_sessions INTEGER NOT NULL,
  package_value NUMERIC(12,2),
  amount_collected NUMERIC(12,2),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PT ASSIGNMENTS (trainer ↔ client recurring)
-- ============================================================
CREATE TABLE pt_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES pt_clients(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  package_id UUID REFERENCES pt_packages(id),
  days_of_week INTEGER[] NOT NULL DEFAULT '{}', -- [1,3,5] = Mon,Wed,Fri
  preferred_time TIME NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = ongoing
  total_sessions INTEGER,
  notes TEXT,
  assigned_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PT ASSIGNMENT HISTORY (reassignment log)
-- ============================================================
CREATE TABLE pt_assignment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES pt_clients(id),
  previous_trainer_id UUID REFERENCES trainers(id),
  new_trainer_id UUID REFERENCES trainers(id),
  assignment_id UUID REFERENCES pt_assignments(id),
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PT SESSIONS
-- ============================================================
CREATE TABLE pt_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES pt_assignments(id),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  client_id UUID NOT NULL REFERENCES pt_clients(id),
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  notes TEXT,
  session_revenue NUMERIC(12,2), -- PT fee for this session
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAINER FEEDBACK
-- ============================================================
CREATE TABLE trainer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  client_id UUID NOT NULL REFERENCES pt_clients(id),
  session_id UUID REFERENCES pt_sessions(id),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  is_punctual BOOLEAN,
  satisfied_with_progress BOOLEAN,
  would_continue BOOLEAN,
  written_feedback TEXT,
  is_flagged BOOLEAN DEFAULT FALSE,
  manager_reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAINER PAYOUTS (monthly header)
-- ============================================================
CREATE TABLE trainer_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  commission_rule_id UUID REFERENCES trainer_commission_rules(id),
  commission_type TEXT NOT NULL,
  commission_value NUMERIC(10,2) NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  eligible_revenue NUMERIC(12,2) DEFAULT 0,
  calculated_payout NUMERIC(12,2) DEFAULT 0,
  adjustments NUMERIC(12,2) DEFAULT 0,
  adjustment_notes TEXT,
  final_payout NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'paid')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, period_month, period_year)
);

-- ============================================================
-- TRAINER PAYOUT ITEMS (session-level line items)
-- ============================================================
CREATE TABLE trainer_payout_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_id UUID NOT NULL REFERENCES trainer_payouts(id) ON DELETE CASCADE,
  session_id UUID REFERENCES pt_sessions(id),
  gym_id UUID NOT NULL REFERENCES gyms(id),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  client_id UUID NOT NULL REFERENCES pt_clients(id),
  session_date DATE NOT NULL,
  session_revenue NUMERIC(12,2) DEFAULT 0,
  commission_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gym_id UUID REFERENCES gyms(id),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_trainers_gym_id ON trainers(gym_id);
CREATE INDEX idx_trainers_status ON trainers(status);
CREATE INDEX idx_pt_clients_gym_id ON pt_clients(gym_id);
CREATE INDEX idx_pt_assignments_gym_id ON pt_assignments(gym_id);
CREATE INDEX idx_pt_assignments_trainer_id ON pt_assignments(trainer_id);
CREATE INDEX idx_pt_assignments_client_id ON pt_assignments(client_id);
CREATE INDEX idx_pt_sessions_gym_id ON pt_sessions(gym_id);
CREATE INDEX idx_pt_sessions_trainer_id ON pt_sessions(trainer_id);
CREATE INDEX idx_pt_sessions_client_id ON pt_sessions(client_id);
CREATE INDEX idx_pt_sessions_date ON pt_sessions(session_date);
CREATE INDEX idx_pt_sessions_status ON pt_sessions(status);
CREATE INDEX idx_trainer_payouts_trainer_id ON trainer_payouts(trainer_id);
CREATE INDEX idx_audit_logs_gym_id ON audit_logs(gym_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's gym_id
CREATE OR REPLACE FUNCTION get_user_gym_id()
RETURNS UUID AS $$
  SELECT gym_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get trainer's trainer_id for current user
CREATE OR REPLACE FUNCTION get_trainer_id_for_user()
RETURNS UUID AS $$
  SELECT id FROM trainers WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- GYMS: managers see their own gym, super_admin sees all
CREATE POLICY "gym_select" ON gyms FOR SELECT USING (
  get_user_role() = 'super_admin' OR id = get_user_gym_id()
);

-- PROFILES: users see their own profile
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid() OR get_user_role() IN ('super_admin', 'gym_manager')
);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- TRAINERS: managers see their gym's trainers, trainers see themselves
CREATE POLICY "trainers_select" ON trainers FOR SELECT USING (
  gym_id = get_user_gym_id() OR user_id = auth.uid()
);
CREATE POLICY "trainers_insert" ON trainers FOR INSERT WITH CHECK (
  gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager'
);
CREATE POLICY "trainers_update" ON trainers FOR UPDATE USING (
  gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager'
);

-- TRAINER WORKING HOURS
CREATE POLICY "twh_select" ON trainer_working_hours FOR SELECT USING (gym_id = get_user_gym_id());
CREATE POLICY "twh_insert" ON trainer_working_hours FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "twh_update" ON trainer_working_hours FOR UPDATE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "twh_delete" ON trainer_working_hours FOR DELETE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');

-- TRAINER LEAVES
CREATE POLICY "tl_select" ON trainer_leaves FOR SELECT USING (gym_id = get_user_gym_id());
CREATE POLICY "tl_insert" ON trainer_leaves FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "tl_delete" ON trainer_leaves FOR DELETE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');

-- TRAINER BLOCKED SLOTS
CREATE POLICY "tbs_select" ON trainer_blocked_slots FOR SELECT USING (gym_id = get_user_gym_id());
CREATE POLICY "tbs_insert" ON trainer_blocked_slots FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "tbs_delete" ON trainer_blocked_slots FOR DELETE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');

-- TRAINER COMMISSION RULES: managers see all in gym, trainers see their own (not values if manager restricts)
CREATE POLICY "tcr_select" ON trainer_commission_rules FOR SELECT USING (
  gym_id = get_user_gym_id()
);
CREATE POLICY "tcr_insert" ON trainer_commission_rules FOR INSERT WITH CHECK (
  gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager'
);

-- PT CLIENTS
CREATE POLICY "ptc_select" ON pt_clients FOR SELECT USING (gym_id = get_user_gym_id());
CREATE POLICY "ptc_insert" ON pt_clients FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "ptc_update" ON pt_clients FOR UPDATE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');

-- PT PACKAGES
CREATE POLICY "ptp_select" ON pt_packages FOR SELECT USING (gym_id = get_user_gym_id());
CREATE POLICY "ptp_insert" ON pt_packages FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "ptp_update" ON pt_packages FOR UPDATE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');

-- PT ASSIGNMENTS: managers see all, trainers see their own
CREATE POLICY "pta_select" ON pt_assignments FOR SELECT USING (
  gym_id = get_user_gym_id() AND (
    get_user_role() = 'gym_manager' OR trainer_id = get_trainer_id_for_user()
  )
);
CREATE POLICY "pta_insert" ON pt_assignments FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "pta_update" ON pt_assignments FOR UPDATE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');

-- PT ASSIGNMENT HISTORY
CREATE POLICY "ptah_select" ON pt_assignment_history FOR SELECT USING (gym_id = get_user_gym_id());
CREATE POLICY "ptah_insert" ON pt_assignment_history FOR INSERT WITH CHECK (gym_id = get_user_gym_id());

-- PT SESSIONS: managers see all, trainers see their own
CREATE POLICY "pts_select" ON pt_sessions FOR SELECT USING (
  gym_id = get_user_gym_id() AND (
    get_user_role() = 'gym_manager' OR trainer_id = get_trainer_id_for_user()
  )
);
CREATE POLICY "pts_insert" ON pt_sessions FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "pts_update" ON pt_sessions FOR UPDATE USING (
  gym_id = get_user_gym_id() AND (
    get_user_role() = 'gym_manager' OR trainer_id = get_trainer_id_for_user()
  )
);

-- TRAINER FEEDBACK
CREATE POLICY "tf_select" ON trainer_feedback FOR SELECT USING (
  gym_id = get_user_gym_id() AND (
    get_user_role() = 'gym_manager' OR trainer_id = get_trainer_id_for_user()
  )
);
CREATE POLICY "tf_insert" ON trainer_feedback FOR INSERT WITH CHECK (gym_id = get_user_gym_id());

-- TRAINER PAYOUTS: managers see all, trainers see ONLY their own (not others)
CREATE POLICY "tp_select" ON trainer_payouts FOR SELECT USING (
  gym_id = get_user_gym_id() AND (
    get_user_role() = 'gym_manager' OR trainer_id = get_trainer_id_for_user()
  )
);
CREATE POLICY "tp_insert" ON trainer_payouts FOR INSERT WITH CHECK (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');
CREATE POLICY "tp_update" ON trainer_payouts FOR UPDATE USING (gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager');

-- TRAINER PAYOUT ITEMS
CREATE POLICY "tpi_select" ON trainer_payout_items FOR SELECT USING (
  gym_id = get_user_gym_id() AND (
    get_user_role() = 'gym_manager' OR trainer_id = get_trainer_id_for_user()
  )
);

-- AUDIT LOGS
CREATE POLICY "al_select" ON audit_logs FOR SELECT USING (
  gym_id = get_user_gym_id() AND get_user_role() = 'gym_manager'
);
CREATE POLICY "al_insert" ON audit_logs FOR INSERT WITH CHECK (gym_id = get_user_gym_id());
