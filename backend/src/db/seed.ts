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

    // 3. Super Admin
    const { account: superAdminAcc } = await ensureAccountAndPerson(
      'superadmin@rajalakshmi.edu.in',
      'Super Administrator (REC)',
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

    // 4. Standard Gym Admin
    const { account: adminAcc } = await ensureAccountAndPerson(
      'admin@rajalakshmi.edu.in',
      'Gym Administrator',
      'admin',
      'admin'
    );
    const [existingAdminProfile] = await db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.accountId, adminAcc.id))
      .limit(1);
    if (!existingAdminProfile) {
      await db.insert(adminProfiles).values({
        accountId: adminAcc.id,
        roleId: gymAdminRole.id,
        isProtectedSuperAdmin: 'false',
      });
    }

    // 5. Hosteller Student
    const { person: hostellerPerson } = await ensureAccountAndPerson(
      'hosteller@rajalakshmi.edu.in',
      'Karthik Raja (Hosteller)',
      'student',
      'student',
      '+919876543210'
    );
    const [existingHosteller] = await db
      .select()
      .from(students)
      .where(eq(students.personId, hostellerPerson.id))
      .limit(1);
    if (!existingHosteller) {
      await db.insert(students).values({
        personId: hostellerPerson.id,
        rollNumber: '2024CS001',
        department: 'Computer Science and Engineering',
        joiningYear: 2024,
        residency: 'hosteller',
        faceEnrollmentStatus: 'enrolled',
        emergencyContact: '+919876500001',
      });
    }

    // 6. Day Scholar Student
    const { person: dayScholarPerson } = await ensureAccountAndPerson(
      'dayscholar@rajalakshmi.edu.in',
      'Priya Sharma (Day Scholar)',
      'student',
      'student',
      '+919876543211'
    );
    const [existingDayScholar] = await db
      .select()
      .from(students)
      .where(eq(students.personId, dayScholarPerson.id))
      .limit(1);
    if (!existingDayScholar) {
      await db.insert(students).values({
        personId: dayScholarPerson.id,
        rollNumber: '2024IT042',
        department: 'Information Technology',
        joiningYear: 2024,
        residency: 'day_scholar',
        faceEnrollmentStatus: 'not_enrolled',
        emergencyContact: '+919876500002',
      });
    }

    // 7. Trainer
    const { person: trainerPerson } = await ensureAccountAndPerson(
      'trainer@rajalakshmi.edu.in',
      'Vignesh Kumar (Trainer)',
      'trainer',
      'trainer',
      '+919876543212'
    );
    const [existingTrainerStudent] = await db
      .select()
      .from(students)
      .where(eq(students.personId, trainerPerson.id))
      .limit(1);
    if (!existingTrainerStudent) {
      await db.insert(students).values({
        personId: trainerPerson.id,
        rollNumber: '2023ME015',
        department: 'Mechanical Engineering',
        joiningYear: 2023,
        residency: 'hosteller',
        faceEnrollmentStatus: 'enrolled',
      });
    }
    const [existingTrainerProfile] = await db
      .select()
      .from(trainerProfiles)
      .where(eq(trainerProfiles.personId, trainerPerson.id))
      .limit(1);
    if (!existingTrainerProfile) {
      await db.insert(trainerProfiles).values({
        personId: trainerPerson.id,
        hourlyRate: '200.00',
      });
    }

    // 8. Staff
    const { person: staffPerson } = await ensureAccountAndPerson(
      'staff@rajalakshmi.edu.in',
      'Dr. S. Ramesh (Faculty)',
      'staff',
      'staff',
      '+919876543213'
    );
    const [existingStaff] = await db
      .select()
      .from(staff)
      .where(eq(staff.personId, staffPerson.id))
      .limit(1);
    if (!existingStaff) {
      await db.insert(staff).values({
        personId: staffPerson.id,
        staffId: 'REC-FAC-108',
        department: 'Physical Education',
        designation: 'Sports Coordinator',
      });
    }

    // 9. Authorized Person
    const { person: guestPerson } = await ensureAccountAndPerson(
      'guest@rajalakshmi.edu.in',
      'Trustee / VIP Guest',
      'authorized_person',
      'authorized_person'
    );
    const [existingGuest] = await db
      .select()
      .from(authorizedPersons)
      .where(eq(authorizedPersons.personId, guestPerson.id))
      .limit(1);
    if (!existingGuest) {
      await db.insert(authorizedPersons).values({
        personId: guestPerson.id,
        designation: 'College Trustee / Special Access',
      });
    }

    logger.info('Database seeding completed successfully.');
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
