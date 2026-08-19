import { pool } from '../shared/database/index.js';
import { logger } from '../shared/logging/index.js';
import { runMigrations } from './migrate.js';

export const cleanDatabase = async () => {
  logger.info('Starting complete database cleanup of all mock data...');

  await runMigrations();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear operational, transactional, and audit tables
    logger.info('Truncating transactional and log tables...');
    await client.query(`
      TRUNCATE TABLE 
        booking.violations,
        booking.bookings,
        access.access_sessions,
        access.entry_exit_logs,
        membership.memberships,
        payment.payment_orders,
        trainer.work_shifts,
        admin.gym_calendar,
        audit.audit_logs,
        identity.sessions
      CASCADE;
    `);

    // 2. Clear mock entities (students, staff, authorized_persons, trainers)
    logger.info('Cleaning mock entity tables...');
    await client.query(`
      TRUNCATE TABLE 
        people.students,
        people.staff,
        people.authorized_persons,
        trainer.trainer_profiles
      CASCADE;
    `);

    // 3. Delete all non-super-admin accounts, oauth providers, and people
    logger.info('Removing mock users (preserving iiic@rajalakshmi.edu.in)...');
    await client.query(`
      DELETE FROM admin.admin_profiles 
      WHERE account_id NOT IN (
        SELECT id FROM identity.accounts WHERE LOWER(email) = 'iiic@rajalakshmi.edu.in'
      );

      DELETE FROM identity.oauth_providers
      WHERE account_id NOT IN (
        SELECT id FROM identity.accounts WHERE LOWER(email) = 'iiic@rajalakshmi.edu.in'
      );

      DELETE FROM people.people
      WHERE LOWER(email) != 'iiic@rajalakshmi.edu.in';

      DELETE FROM identity.accounts
      WHERE LOWER(email) != 'iiic@rajalakshmi.edu.in';
    `);

    // 4. Ensure Super Administrator and default roles exist
    logger.info('Setting up role templates...');
    await client.query(`
      INSERT INTO admin.roles (name, description, permissions)
      VALUES 
        ('Super Administrator', 'Unrestricted full system administrative access', '["*"]'::jsonb),
        ('Gym Manager', 'Manages memberships, slot bookings, trainers, and reports', '["students.read", "students.write", "memberships.manage", "slots.manage", "trainers.read", "trainers.manage", "biometrics.manage", "violations.manage", "conflicts.manage", "reports.export", "analytics.read"]'::jsonb),
        ('Front Desk / Supervisor', 'Live turnstile monitoring, conflict desk, and attendance', '["students.read", "slots.manage", "conflicts.manage"]'::jsonb),
        ('Pass / Accounts Admin', 'Day scholar membership passes, payments, and financial reports', '["memberships.manage", "reports.export", "analytics.read"]'::jsonb)
      ON CONFLICT (name) DO UPDATE SET 
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions;
    `);

    // 5. Ensure default membership plans exist
    logger.info('Setting up official membership plans...');
    await client.query(`
      INSERT INTO membership.membership_plans (name, duration_days, price, is_active)
      VALUES 
        ('1-Month Student Pass', 30, 500.00, 'active'),
        ('3-Month Student Pass', 90, 1200.00, 'active'),
        ('1-Year Annual Pass', 365, 4000.00, 'active')
      ON CONFLICT DO NOTHING;
    `);

    // 6. Ensure iiic@rajalakshmi.edu.in is created and linked as Super Admin
    logger.info('Ensuring iiic@rajalakshmi.edu.in is configured as protected Super Admin...');
    const superRoleRes = await client.query(`SELECT id FROM admin.roles WHERE name = 'Super Administrator' LIMIT 1;`);
    const superRoleId = superRoleRes.rows[0]?.id;

    // Account
    const accRes = await client.query(`
      INSERT INTO identity.accounts (email, role, is_active)
      VALUES ('iiic@rajalakshmi.edu.in', 'super_admin', true)
      ON CONFLICT (email) DO UPDATE SET role = 'super_admin', is_active = true
      RETURNING id;
    `);
    const superAccountId = accRes.rows[0].id;

    // Person
    await client.query(`
      INSERT INTO people.people (account_id, name, email, person_type, status)
      VALUES ($1, 'IIIC Super Administrator', 'iiic@rajalakshmi.edu.in', 'admin', 'active')
      ON CONFLICT (email) DO UPDATE SET account_id = $1, person_type = 'admin', status = 'active';
    `, [superAccountId]);

    // Admin Profile
    await client.query(`
      INSERT INTO admin.admin_profiles (account_id, role_id, is_protected_super_admin)
      VALUES ($1, $2, 'true')
      ON CONFLICT (account_id) DO UPDATE SET role_id = $2, is_protected_super_admin = 'true';
    `, [superAccountId, superRoleId]);

    await client.query('COMMIT');
    logger.info('Database clean & foundation provisioning completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Error cleaning database');
    throw err;
  } finally {
    client.release();
  }
};

if (process.argv[1] && process.argv[1].includes('clean.ts')) {
  cleanDatabase()
    .then(() => {
      logger.info('Cleanup script finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Cleanup script failed');
      process.exit(1);
    });
}
