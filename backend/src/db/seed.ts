import { eq } from 'drizzle-orm';
import { db, pool } from '../shared/database/index.js';
import { logger } from '../shared/logging/index.js';
import { runMigrations } from './migrate.js';
import {
  people,
  accounts,
  students,
  staff,
  authorizedPersons,
  trainerProfiles,
  adminProfiles,
  roles,
  membershipPlans,
} from './schema/index.js';

export const seedDatabase = async () => {
  logger.info('Starting database seeding...');

  // 0. Ensure all 11 schemas & tables exist
  await runMigrations();

  try {
    // 1. Helper to find or insert role
    const getOrCreateRole = async (name: string, description: string, permissions: string[]) => {
      const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
      if (existing) return existing;

      const [inserted] = await db
        .insert(roles)
        .values({ name, description, permissions })
        .returning();
      return inserted;
    };

    const superAdminRole = await getOrCreateRole(
      'Super Administrator',
      'Unrestricted full system administrative access',
      ['*']
    );

    const gymAdminRole = await getOrCreateRole(
      'Gym Manager',
      'Manages memberships, slot booking, trainer hours, and reports',
      [
        'students.read',
        'students.write',
        'memberships.manage',
        'slots.manage',
        'trainers.read',
        'trainers.manage',
        'reports.export',
        'conflicts.manage',
      ]
    );

    // 2. Create Default Membership Plans
    const defaultPlans = [
      { name: '1-Month Student Pass', durationDays: 30, price: '500.00', isActive: 'active' },
      { name: '3-Month Student Pass', durationDays: 90, price: '1200.00', isActive: 'active' },
      { name: '1-Year Annual Pass', durationDays: 365, price: '4000.00', isActive: 'active' },
    ];

    for (const plan of defaultPlans) {
      const [existingPlan] = await db
        .select()
        .from(membershipPlans)
        .where(eq(membershipPlans.name, plan.name))
        .limit(1);
      if (!existingPlan) {
        await db.insert(membershipPlans).values(plan);
      }
    }

    // Helper to find or insert account + person
    const ensureAccountAndPerson = async (
      email: string,
      name: string,
      role: 'student' | 'staff' | 'trainer' | 'admin' | 'super_admin' | 'authorized_person',
      personType: 'student' | 'staff' | 'trainer' | 'admin' | 'authorized_person',
      phone?: string
    ) => {
      let [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
      if (!account) {
        const [newAcc] = await db.insert(accounts).values({ email, role, isActive: true }).returning();
        account = newAcc;
      }

      let [person] = await db.select().from(people).where(eq(people.email, email)).limit(1);
      if (!person) {
        const [newPer] = await db
          .insert(people)
          .values({
            accountId: account.id,
            name,
            email,
            phone,
            personType,
            status: 'active',
          })
          .returning();
        person = newPer;
      }

      return { account, person };
    };

    // 3. Super Admin (IIIC)
    const { account: superAdminAcc } = await ensureAccountAndPerson(
      'iiic@rajalakshmi.edu.in',
      'Super Administrator (IIIC)',
      'super_admin',
      'admin'
    );
    const [existingSuperProfile] = await db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.accountId, superAdminAcc.id))
      .limit(1);
    if (!existingSuperProfile) {
      await db.insert(adminProfiles).values({
        accountId: superAdminAcc.id,
        roleId: superAdminRole.id,
        isProtectedSuperAdmin: 'true',
      });
    }

    logger.info('Database production foundation seeding completed successfully.');
  } catch (err) {
    logger.error({ err }, 'Error during database seed');
    throw err;
  }
};

if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  seedDatabase()
    .then(() => {
      logger.info('Seed finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Seed failed');
      process.exit(1);
    });
}
