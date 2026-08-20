import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';
import {
  students,
  people,
  memberships,
  paymentOrders,
  accessSessions,
  violations,
  slots,
  bookings,
  gymCalendar,
  auditLogs,
  accounts,
  adminProfiles,
  roles,
} from '../../db/schema/index.js';
import { bookingService } from '../booking/booking.service.js';
import {
  ExecutiveAnalyticsDto,
  GymClosureDto,
  AuditLogEntryDto,
  RoleItemDto,
  AdminListItemDto,
} from './admin.types.js';

export class AdminService {
  /**
   * Aggregate executive KPI analytics (FR-ADM-001)
   */
  public async getExecutiveAnalytics(): Promise<ExecutiveAnalyticsDto> {
    const todayStr = bookingService.formatISTDate();
    const now = new Date();

    // 1. Student Breakdown
    const allStudents = await db.select({ residency: students.residency }).from(students);
    const totalRegisteredStudents = allStudents.length;
    const totalHostellers = allStudents.filter((s) => s.residency === 'hosteller').length;
    const totalDayScholars = allStudents.filter((s) => s.residency === 'day_scholar').length;

    // 2. Active Memberships
    const activeMem = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.status, 'active'), sql`${memberships.endDate} >= ${now}`));
    const activeMembershipsCount = activeMem.length;

    // 3. Today's Total Check-Ins
    const todaySessions = await db
      .select({ id: accessSessions.id })
      .from(accessSessions)
      .where(sql`DATE(${accessSessions.entryTimestamp} AT TIME ZONE 'Asia/Kolkata') = ${todayStr}`);
    const todayTotalCheckIns = todaySessions.length;

    // 4. Current Live Occupants
    const live = await db
      .select({ id: accessSessions.id })
      .from(accessSessions)
      .where(eq(accessSessions.status, 'inside'));
    const currentLiveOccupants = live.length;

    // 5. Total Revenue This Month
    const currentMonth = todayStr.slice(0, 7);
    const paidOrders = await db
      .select({ amount: paymentOrders.amount, createdAt: paymentOrders.createdAt })
      .from(paymentOrders)
      .where(eq(paymentOrders.status, 'paid'));

    let totalMonthlyRevenue = 0;
    for (const o of paidOrders) {
      if (o.createdAt.toISOString().slice(0, 7) === currentMonth) {
        totalMonthlyRevenue += parseFloat(o.amount);
      }
    }

    // 6. Violations This Month
    const allViolations = await db.select({ createdAt: violations.createdAt }).from(violations);
    const totalViolationsThisMonth = allViolations.filter(
      (v) => v.createdAt.toISOString().slice(0, 7) === currentMonth
    ).length;

    // 7. Peak Hours Breakdown (Dynamic aggregate from access_sessions)
    const hourBuckets = [
      { hour: '06:00 - 07:00', startHour: 6, count: 0 },
      { hour: '07:00 - 08:00', startHour: 7, count: 0 },
      { hour: '08:00 - 09:00', startHour: 8, count: 0 },
      { hour: '09:00 - 10:00', startHour: 9, count: 0 },
      { hour: '16:00 - 17:00', startHour: 16, count: 0 },
      { hour: '17:00 - 18:00', startHour: 17, count: 0 },
      { hour: '18:00 - 19:00', startHour: 18, count: 0 },
      { hour: '19:00 - 20:00', startHour: 19, count: 0 },
    ];

    const recentSessions = await db
      .select({ entryTimestamp: accessSessions.entryTimestamp })
      .from(accessSessions)
      .limit(500);

    for (const s of recentSessions) {
      if (s.entryTimestamp) {
        const hour = new Date(s.entryTimestamp).getHours();
        const bucket = hourBuckets.find((b) => b.startHour === hour);
        if (bucket) {
          bucket.count += 1;
        }
      }
    }

    const peakHours = hourBuckets.map((b) => ({
      hour: b.hour,
      count: b.count,
    }));

    return {
      totalRegisteredStudents,
      totalHostellers,
      totalDayScholars,
      activeMembershipsCount,
      todayTotalCheckIns,
      currentLiveOccupants,
      totalMonthlyRevenue: Math.round(totalMonthlyRevenue * 100) / 100,
      totalViolationsThisMonth,
      peakHours,
    };
  }

  /**
   * Get all gym closure blackout dates
   */
  public async getCalendarClosures(): Promise<GymClosureDto[]> {
    const closures = await db.select().from(gymCalendar).orderBy(desc(gymCalendar.closureDate));

    return closures.map((c) => ({
      id: c.id,
      closureDate: c.closureDate,
      reason: c.reason,
      cancelledBookingsCount: parseInt(c.cancelledBookingsCount || '0', 10),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /**
   * Emergency Gym Closure / Date Locking Cascade (ADR-017, FR-ADM-002)
   */
  public async createCalendarClosure(closureDate: string, reason: string, adminEmail: string): Promise<GymClosureDto> {
    const [existing] = await db.select().from(gymCalendar).where(eq(gymCalendar.closureDate, closureDate)).limit(1);

    if (existing) {
      throw new ConflictError(`Closure already recorded for date '${closureDate}'`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Close all slots on this date
      await client.query(
        `UPDATE booking.slots 
         SET status = 'closed' 
         WHERE slot_date = $1`,
        [closureDate]
      );

      // 2. Find and cancel all affected active bookings
      const cancelRes = await client.query(
        `UPDATE booking.bookings b
         SET booking_status = 'cancelled_by_gym',
             cancellation_reason = $1,
             cancelled_at = NOW(),
             updated_at = NOW()
         FROM booking.slots s
         LEFT JOIN people.students st ON b.student_id = st.id
         LEFT JOIN people.people p ON st.person_id = p.id
         WHERE b.slot_id = s.id 
           AND s.slot_date = $2 
           AND b.booking_status = 'booked'
         RETURNING b.id, p.account_id`,
        [`Gym Closure: ${reason}`, closureDate]
      );

      const affectedCount = cancelRes.rows.length;

      // 3. Notify affected students
      for (const row of cancelRes.rows) {
        if (row.account_id) {
          await client.query(
            `INSERT INTO notification.notification_logs (account_id, event_type, title, message, created_at)
             VALUES ($1, 'system_alert', 'Gym Reservation Cancelled — Date Locked', $2, NOW())`,
            [
              row.account_id,
              `Your gym reservation on ${closureDate} was cancelled because the gym is closed for: ${reason}. Your daily booking quota has been restored so you can reserve another slot.`,
            ]
          );
        }
      }

      // 4. Record in gym_calendar
      const insertCal = await client.query(
        `INSERT INTO admin.gym_calendar (closure_date, reason, cancelled_bookings_count, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, closure_date, reason, cancelled_bookings_count, created_at`,
        [closureDate, reason, String(affectedCount)]
      );

      const newClosure = insertCal.rows[0];

      // 5. Audit Log
      await client.query(
        `INSERT INTO audit.audit_logs (actor_email, action, entity, entity_id, reason, created_at)
         VALUES ($1, 'emergency_calendar_closure', 'calendar', $2, $3, NOW())`,
        [adminEmail, closureDate, `${reason} (${affectedCount} reservations auto-cancelled and notified)`]
      );

      await client.query('COMMIT');

      logger.info(
        { closureDate, affectedCount, adminEmail },
        'Gym emergency closure executed and users notified successfully'
      );

      return {
        id: newClosure.id,
        closureDate: newClosure.closure_date,
        reason: newClosure.reason,
        cancelledBookingsCount: affectedCount,
        createdAt: newClosure.created_at,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Unlock / Re-open a previously closed date
   */
  public async unlockDate(closureDate: string, adminEmail: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Remove closure record
      await client.query(`DELETE FROM admin.gym_calendar WHERE closure_date = $1`, [closureDate]);

      // 2. Re-open slots for that date
      await client.query(
        `UPDATE booking.slots 
         SET status = 'open' 
         WHERE slot_date = $1`,
        [closureDate]
      );

      // 3. Audit Log
      await client.query(
        `INSERT INTO audit.audit_logs (actor_email, action, entity, entity_id, reason, created_at)
         VALUES ($1, 'unlock_calendar_date', 'calendar', $2, 'Unlocked date and re-opened slots', NOW())`,
        [adminEmail, closureDate]
      );

      await client.query('COMMIT');
      logger.info({ closureDate, adminEmail }, 'Gym date unlocked and slots re-opened successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * System Audit Log Explorer (FR-ADM-004)
   */
  public async getAuditLogs(limit = 50): Promise<AuditLogEntryDto[]> {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);

    return logs.map((l) => ({
      id: l.id,
      actorEmail: l.actorEmail || undefined,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  /**
   * List all defined admin roles
   */
  public async getRoles(): Promise<RoleItemDto[]> {
    const allRoles = await db.select().from(roles);
    return allRoles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: (r.permissions as string[]) || [],
    }));
  }

  /**
   * List all gym administrators
   */
  public async getAdmins(): Promise<AdminListItemDto[]> {
    const profiles = await db
      .select({
        id: adminProfiles.id,
        accountId: adminProfiles.accountId,
        roleId: adminProfiles.roleId,
        customPermissions: adminProfiles.customPermissions,
        isProtectedSuperAdmin: adminProfiles.isProtectedSuperAdmin,
        createdAt: adminProfiles.createdAt,
        accountEmail: accounts.email,
        accountLastLogin: accounts.lastLoginAt,
        personId: people.id,
        personName: people.name,
        personPhone: people.phone,
        personStatus: people.status,
        roleName: roles.name,
        rolePermissions: roles.permissions,
      })
      .from(adminProfiles)
      .innerJoin(accounts, eq(adminProfiles.accountId, accounts.id))
      .leftJoin(people, eq(people.accountId, accounts.id))
      .leftJoin(roles, eq(adminProfiles.roleId, roles.id))
      .orderBy(desc(adminProfiles.createdAt));

    return profiles.map((p) => {
      const activePermissions =
        p.isProtectedSuperAdmin === 'true'
          ? ['*']
          : Array.isArray(p.customPermissions) && p.customPermissions.length > 0
          ? (p.customPermissions as string[])
          : ((p.rolePermissions as string[]) || []);

      return {
        id: p.id,
        accountId: p.accountId,
        personId: p.personId || p.accountId,
        name: p.personName || p.accountEmail.split('@')[0],
        email: p.accountEmail,
        phone: p.personPhone,
        roleName: p.isProtectedSuperAdmin === 'true' ? 'Super Administrator' : (p.roleName || 'Custom Admin'),
        roleId: p.roleId,
        permissions: activePermissions,
        isProtectedSuperAdmin: p.isProtectedSuperAdmin === 'true',
        status: p.personStatus || 'active',
        createdAt: p.createdAt.toISOString(),
        lastLoginAt: p.accountLastLogin ? p.accountLastLogin.toISOString() : null,
      };
    });
  }

  /**
   * Create or promote a user to Administrator (Super Admin Only)
   */
  public async createAdmin(
    data: { email: string; name: string; phone?: string; roleId?: string; permissions?: string[] },
    actorEmail: string
  ): Promise<AdminListItemDto> {
    const normalizedEmail = data.email.toLowerCase().trim();

    // 1. Ensure or find people record
    let [person] = await db.select().from(people).where(eq(people.email, normalizedEmail)).limit(1);
    if (!person) {
      const [newPerson] = await db
        .insert(people)
        .values({
          name: data.name.trim(),
          email: normalizedEmail,
          phone: data.phone?.trim(),
          personType: 'admin',
          status: 'active',
        })
        .returning();
      person = newPerson;
    } else {
      await db
        .update(people)
        .set({ personType: 'admin', status: 'active', phone: data.phone?.trim() || person.phone })
        .where(eq(people.id, person.id));
    }

    // 2. Ensure or find account record
    let [account] = await db.select().from(accounts).where(eq(accounts.email, normalizedEmail)).limit(1);
    if (!account) {
      const [newAccount] = await db
        .insert(accounts)
        .values({
          email: normalizedEmail,
          role: 'admin',
          isActive: true,
        })
        .returning();
      account = newAccount;

      await db
        .update(people)
        .set({ accountId: newAccount.id })
        .where(eq(people.id, person.id));
    } else {
      await db
        .update(accounts)
        .set({ role: 'admin', isActive: true })
        .where(eq(accounts.id, account.id));
    }

    // 3. Check if admin profile already exists
    const [existingProfile] = await db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.accountId, account.id))
      .limit(1);

    if (existingProfile) {
      throw new ConflictError(`Admin profile already exists for email '${normalizedEmail}'`);
    }

    // 4. Insert admin profile with custom permissions
    const [newProfile] = await db
      .insert(adminProfiles)
      .values({
        accountId: account.id,
        roleId: data.roleId || null,
        customPermissions: data.permissions && data.permissions.length > 0 ? data.permissions : null,
        isProtectedSuperAdmin: 'false',
      })
      .returning();

    // 5. Audit Log
    await db.insert(auditLogs).values({
      actorEmail,
      action: 'create_admin',
      entity: 'admin_profile',
      entityId: newProfile.id,
      reason: `Provisioned administrator '${normalizedEmail}' with roleId '${data.roleId || 'custom'}' and ${data.permissions?.length || 0} permissions`,
    });

    let roleName = 'Custom Admin';
    let rolePermissions: string[] = data.permissions || [];
    if (data.roleId) {
      const [roleRec] = await db.select().from(roles).where(eq(roles.id, data.roleId)).limit(1);
      if (roleRec) {
        roleName = roleRec.name;
        if (!data.permissions || data.permissions.length === 0) {
          rolePermissions = (roleRec.permissions as string[]) || [];
        }
      }
    }

    return {
      id: newProfile.id,
      accountId: account.id,
      personId: person.id,
      name: person.name,
      email: account.email,
      phone: person.phone,
      roleName,
      roleId: data.roleId || null,
      permissions: rolePermissions,
      isProtectedSuperAdmin: false,
      status: person.status,
      createdAt: newProfile.createdAt.toISOString(),
      lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
    };
  }

  /**
   * Update an administrator's role or status (Super Admin Only)
   */
  public async updateAdmin(
    adminProfileId: string,
    data: { roleId?: string; permissions?: string[]; status?: 'active' | 'inactive' | 'suspended' },
    actorEmail: string
  ): Promise<void> {
    const [profile] = await db.select().from(adminProfiles).where(eq(adminProfiles.id, adminProfileId)).limit(1);
    if (!profile) {
      throw new NotFoundError(`Admin profile with ID '${adminProfileId}' not found`);
    }

    if (profile.isProtectedSuperAdmin === 'true') {
      throw new ConflictError('Cannot modify protected Super Administrator');
    }

    const updates: Partial<typeof adminProfiles.$inferInsert> = {};
    if (data.roleId !== undefined) {
      updates.roleId = data.roleId;
    }
    if (data.permissions !== undefined) {
      updates.customPermissions = data.permissions;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(adminProfiles)
        .set(updates)
        .where(eq(adminProfiles.id, adminProfileId));
    }

    if (data.status) {
      const [acc] = await db.select().from(accounts).where(eq(accounts.id, profile.accountId)).limit(1);
      if (acc) {
        await db
          .update(people)
          .set({ status: data.status })
          .where(eq(people.email, acc.email));
        await db
          .update(accounts)
          .set({ isActive: data.status === 'active' })
          .where(eq(accounts.id, acc.id));
      }
    }

    await db.insert(auditLogs).values({
      actorEmail,
      action: 'update_admin',
      entity: 'admin_profile',
      entityId: adminProfileId,
      reason: `Updated admin profile: roleId=${data.roleId}, permissions=${data.permissions?.length || 'default'}, status=${data.status}`,
    });
  }

  /**
   * Revoke administrator privileges (Super Admin Only)
   */
  public async deleteAdmin(adminProfileId: string, actorEmail: string): Promise<void> {
    const [profile] = await db.select().from(adminProfiles).where(eq(adminProfiles.id, adminProfileId)).limit(1);
    if (!profile) {
      throw new NotFoundError(`Admin profile with ID '${adminProfileId}' not found`);
    }

    if (profile.isProtectedSuperAdmin === 'true') {
      throw new ConflictError('Cannot revoke privileges from protected Super Administrator');
    }

    await db.delete(adminProfiles).where(eq(adminProfiles.id, adminProfileId));

    await db.insert(auditLogs).values({
      actorEmail,
      action: 'revoke_admin',
      entity: 'admin_profile',
      entityId: adminProfileId,
      reason: `Revoked administrator profile ID '${adminProfileId}'`,
    });
  }
}

export const adminService = new AdminService();
