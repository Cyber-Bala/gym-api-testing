-- Complete Table Schema Definitions for College Gym System

-- 1. Identity Domain
CREATE TABLE IF NOT EXISTS identity.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'student',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity.oauth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES identity.accounts(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'google',
  provider_user_id VARCHAR(255) NOT NULL,
  profile_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity.sessions (
  id VARCHAR(128) PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES identity.accounts(id) ON DELETE CASCADE,
  user_agent VARCHAR(512),
  ip_address VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. People Domain
CREATE TABLE IF NOT EXISTS people.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES identity.accounts(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  person_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS people.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people.people(id) ON DELETE CASCADE UNIQUE,
  roll_number VARCHAR(50) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  joining_year INTEGER NOT NULL,
  residency VARCHAR(50) NOT NULL DEFAULT 'day_scholar',
  face_enrollment_status VARCHAR(50) NOT NULL DEFAULT 'not_enrolled',
  face_reference_id VARCHAR(255),
  emergency_contact VARCHAR(20),
  address TEXT,
  health_concerns TEXT,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_expires_at TIMESTAMPTZ,
  violation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS people.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people.people(id) ON DELETE CASCADE UNIQUE,
  staff_id VARCHAR(50) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  designation VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS people.authorized_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people.people(id) ON DELETE CASCADE UNIQUE,
  designation VARCHAR(100) NOT NULL,
  notes TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Admin Domain
CREATE TABLE IF NOT EXISTS admin.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin.admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES identity.accounts(id) ON DELETE CASCADE UNIQUE,
  role_id UUID REFERENCES admin.roles(id),
  is_protected_super_admin VARCHAR(10) NOT NULL DEFAULT 'false',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin.gym_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_date DATE NOT NULL UNIQUE,
  reason VARCHAR(255) NOT NULL,
  cancelled_bookings_count VARCHAR(20) DEFAULT '0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Membership Domain
CREATE TABLE IF NOT EXISTS membership.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  duration_days INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  is_active VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES people.students(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES membership.membership_plans(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  payment_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Booking Domain
CREATE TABLE IF NOT EXISTS booking.slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 100,
  booked_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_date, start_time)
);

CREATE TABLE IF NOT EXISTS booking.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES people.students(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES booking.slots(id) ON DELETE CASCADE,
  booking_status VARCHAR(50) NOT NULL DEFAULT 'booked',
  access_status VARCHAR(50) NOT NULL DEFAULT 'not_entered',
  cancelled_at TIMESTAMPTZ,
  cancellation_reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking.violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES people.students(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES booking.bookings(id) ON DELETE SET NULL,
  violation_type VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Access Domain
CREATE TABLE IF NOT EXISTS access.access_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people.people(id) ON DELETE CASCADE,
  entry_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_timestamp TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'inside',
  entry_device_id VARCHAR(100),
  exit_device_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access.entry_exit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES people.people(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  result VARCHAR(50) NOT NULL,
  denial_reason VARCHAR(255),
  raw_telemetry JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Payment Domain
CREATE TABLE IF NOT EXISTS payment.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES people.students(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES membership.membership_plans(id),
  order_id VARCHAR(255) NOT NULL UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(50) NOT NULL DEFAULT 'created',
  payment_id VARCHAR(255),
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Trainer Domain
CREATE TABLE IF NOT EXISTS trainer.trainer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people.people(id) ON DELETE CASCADE UNIQUE,
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainer.work_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainer.trainer_profiles(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  duration_minutes NUMERIC(10, 2),
  calculated_stipend NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Audit Domain
CREATE TABLE IF NOT EXISTS audit.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES identity.accounts(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL,
  correlation_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Notification Domain
CREATE TABLE IF NOT EXISTS notification.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES identity.accounts(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  user_agent VARCHAR(512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES identity.accounts(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Archive Domain
CREATE TABLE IF NOT EXISTS archive.archive_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  record_count INTEGER NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive.anonymization_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL,
  anonymized_fields JSONB NOT NULL,
  anonymized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
