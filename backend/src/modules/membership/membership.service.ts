import { eq, and, desc, asc, sql, lte, gt, or } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { membershipPlans, memberships, students, people, auditLogs } from '../../db/schema/index.js';
import { MembershipPlanDto, UserMembershipDto, createPlanSchema, updatePlanSchema } from './membership.types.js';

export class MembershipService {
  /**
   * Helper: Resolve student record ID from students table whether students.id or people.id (personId) was passed
   */
  private async resolveStudentId(studentOrPersonId: string): Promise<string> {
    const [stu] = await db
      .select({ id: students.id })
      .from(students)
      .where(or(eq(students.id, studentOrPersonId), eq(students.personId, studentOrPersonId)))
      .limit(1);

    return stu?.id || studentOrPersonId;
  }

  /**
   * Get all active membership plans
   */
  public async getPlans(): Promise<MembershipPlanDto[]> {
    const plans = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.isActive, 'active'))
      .orderBy(membershipPlans.durationDays);

    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      durationDays: p.durationDays,
      price: p.price,
      isActive: p.isActive,
    }));
  }

  /**
   * Get student's current active membership and history
   */
  public async getMyMembership(studentOrPersonId: string): Promise<{
    activeMembership: UserMembershipDto | null;
    history: UserMembershipDto[];
  }> {
    const studentId = await this.resolveStudentId(studentOrPersonId);

    const records = await db
      .select({
        membership: memberships,
        plan: membershipPlans,
      })
      .from(memberships)
      .innerJoin(membershipPlans, eq(memberships.planId, membershipPlans.id))
      .where(eq(memberships.studentId, studentId))
      .orderBy(desc(memberships.createdAt));

    const now = new Date();

    const dtos: UserMembershipDto[] = records.map((r) => {
      const start = new Date(r.membership.startDate);
      const end = new Date(r.membership.endDate);
      // ACTIVE only — no queued / future-start passes
      const isCurrentlyActive =
        r.membership.status === 'active' && start <= now && end > now;
      const msDiff = end.getTime() - now.getTime();
      const daysRemaining = isCurrentlyActive ? Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24))) : 0;

      return {
        id: r.membership.id,
        studentId: r.membership.studentId,
        planId: r.membership.planId,
        planName: r.plan.name,
        price: r.plan.price,
        durationDays: r.plan.durationDays,
        status: r.membership.status,
        startDate: r.membership.startDate.toISOString(),
        endDate: r.membership.endDate.toISOString(),
        daysRemaining,
        isActive: isCurrentlyActive,
        paymentId: r.membership.paymentId || undefined,
        createdAt: r.membership.createdAt.toISOString(),
      };
    });

    const active = dtos.find((d) => d.isActive) || null;

    return {
      activeMembership: active,
      history: dtos,
    };
  }

  /**
   * Activate or extend a membership pass (ACTIVE only — never queued).
   * If a currently-active pass exists, extend its endDate; otherwise create a new active pass starting now.
   */
  public async activateMembership(studentOrPersonId: string, planId: string, paymentId?: string): Promise<UserMembershipDto> {
    const studentId = await this.resolveStudentId(studentOrPersonId);

    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);

    if (!plan) {
      throw new NotFoundError(`Membership plan '${planId}' not found`);
    }

    const now = new Date();
    const durationMs = plan.durationDays * 24 * 60 * 60 * 1000;

    // Currently ACTIVE only (started and not yet expired) — no future-start / queued rows
    const [currentActive] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.studentId, studentId),
          eq(memberships.status, 'active'),
          lte(memberships.startDate, now),
          gt(memberships.endDate, now)
        )
      )
      .orderBy(desc(memberships.endDate))
      .limit(1);

    let record = currentActive;
    let startDate: Date;
    let endDate: Date;

    if (currentActive) {
      startDate = new Date(currentActive.startDate);
      endDate = new Date(new Date(currentActive.endDate).getTime() + durationMs);
      const [updated] = await db
        .update(memberships)
        .set({
          planId,
          endDate,
          paymentId: paymentId || currentActive.paymentId,
          updatedAt: new Date(),
        })
        .where(eq(memberships.id, currentActive.id))
        .returning();
      record = updated;
      logger.info({ studentId, planId, endDate }, 'Active membership pass extended (no queue)');
    } else {
      startDate = now;
      endDate = new Date(now.getTime() + durationMs);
      const [inserted] = await db
        .insert(memberships)
        .values({
          studentId,
          planId,
          status: 'active',
          startDate,
          endDate,
          paymentId,
        })
        .returning();
      record = inserted;
      logger.info({ studentId, planId, startDate, endDate }, 'Membership pass activated successfully');
    }

    const msDiff = endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

    const dto = {
      id: record.id,
      studentId: record.studentId,
      planId: record.planId,
      planName: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      status: record.status,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
      daysRemaining,
      isActive: true,
      paymentId: record.paymentId || undefined,
      createdAt: record.createdAt.toISOString(),
    };

    // Paid: add to ZKBio if a face is already registered (or refresh the pass dates).
    try {
      const { reconcileStudent } = await import('../device-sync/zkbio-provision.service.js');
      await reconcileStudent(studentId);
    } catch (err) {
      logger.warn({ err, studentId }, 'ZKBio provisioning after activation failed');
    }

    return dto;
  }

  /**
   * Background expiry worker: Mark ended passes as expired
   * + revoke gate access on api_app/ZKBio so the turnstile denies
   * with a "please pay to renew" message instead of letting them in.
   */
  public async runDailyMembershipExpiryCheck(): Promise<{ expiredCount: number }> {
    const now = new Date();

    const expired = await db
      .select({ id: memberships.id, studentId: memberships.studentId, endDate: memberships.endDate })
      .from(memberships)
      .where(and(eq(memberships.status, 'active'), lte(memberships.endDate, now)));

    let expiredCount = 0;
    const { reconcileStudent, reconcileAll } = await import('../device-sync/zkbio-provision.service.js');

    for (const m of expired) {
      await db
        .update(memberships)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(memberships.id, m.id));
      expiredCount++;

      // Pass ended: remove them from ZKBio (they stay in the gym app).
      try {
        await reconcileStudent(m.studentId);
      } catch (err) {
        logger.warn({ err, membershipId: m.id }, 'ZKBio removal after expiry failed');
      }
    }

    // Also retries anything that failed earlier (Gym API or ZKBio was off).
    try {
      await reconcileAll();
    } catch (err) {
      logger.warn({ err }, 'ZKBio reconcile pass failed');
    }

    if (expiredCount > 0) {
      logger.info({ expiredCount }, 'Membership expiry worker transitioned passes to expired');
    }

    return { expiredCount };
  }

  /**
   * Admin: List all plans including inactive ones
   */
  public async getAllPlansForAdmin(): Promise<MembershipPlanDto[]> {
    const plans = await db
      .select()
      .from(membershipPlans)
      .orderBy(asc(membershipPlans.durationDays));

    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      durationDays: p.durationDays,
      price: p.price,
      isActive: p.isActive,
    }));
  }

  /**
   * Admin: Create a new membership plan
   */
  public async createPlan(
    data: { name: string; durationDays: number; price: number; isActive?: string },
    actorEmail: string
  ): Promise<MembershipPlanDto> {
    const [created] = await db
      .insert(membershipPlans)
      .values({
        name: data.name,
        durationDays: data.durationDays,
        price: String(data.price),
        isActive: data.isActive || 'active',
      })
      .returning();

    await db.insert(auditLogs).values({
      actorEmail,
      action: 'create_membership_plan',
      entity: 'membership_plan',
      entityId: created.id,
      newValue: { name: created.name, durationDays: created.durationDays, price: created.price },
      reason: 'Admin created membership plan',
    });

    return {
      id: created.id,
      name: created.name,
      durationDays: created.durationDays,
      price: created.price,
      isActive: created.isActive,
    };
  }

  /**
   * Admin: Update an existing membership plan
   */
  public async updatePlan(
    planId: string,
    data: { name?: string; durationDays?: number; price?: number; isActive?: string },
    actorEmail: string
  ): Promise<MembershipPlanDto> {
    const [existing] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
    if (!existing) {
      throw new NotFoundError(`Membership plan '${planId}' not found`);
    }

    const [updated] = await db
      .update(membershipPlans)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.durationDays !== undefined && { durationDays: data.durationDays }),
        ...(data.price !== undefined && { price: String(data.price) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(membershipPlans.id, planId))
      .returning();

    await db.insert(auditLogs).values({
      actorEmail,
      action: 'update_membership_plan',
      entity: 'membership_plan',
      entityId: planId,
      previousValue: {
        name: existing.name,
        durationDays: existing.durationDays,
        price: existing.price,
        isActive: existing.isActive,
      },
      newValue: {
        name: updated.name,
        durationDays: updated.durationDays,
        price: updated.price,
        isActive: updated.isActive,
      },
      reason: 'Admin updated membership plan',
    });

    return {
      id: updated.id,
      name: updated.name,
      durationDays: updated.durationDays,
      price: updated.price,
      isActive: updated.isActive,
    };
  }

  /**
   * Admin: Activate or deactivate a membership plan
   */
  public async setPlanActive(planId: string, isActive: boolean, actorEmail: string): Promise<MembershipPlanDto> {
    const [existing] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
    if (!existing) {
      throw new NotFoundError(`Membership plan '${planId}' not found`);
    }

    const statusValue = isActive ? 'active' : 'inactive';

    const [updated] = await db
      .update(membershipPlans)
      .set({ isActive: statusValue, updatedAt: new Date() })
      .where(eq(membershipPlans.id, planId))
      .returning();

    await db.insert(auditLogs).values({
      actorEmail,
      action: isActive ? 'activate_membership_plan' : 'deactivate_membership_plan',
      entity: 'membership_plan',
      entityId: planId,
      previousValue: { isActive: existing.isActive },
      newValue: { isActive: statusValue },
      reason: isActive ? 'Admin activated membership plan' : 'Admin deactivated membership plan',
    });

    return {
      id: updated.id,
      name: updated.name,
      durationDays: updated.durationDays,
      price: updated.price,
      isActive: updated.isActive,
    };
  }

  /**
   * Admin: Permanently delete a membership plan / package
   */
  public async deletePlan(planId: string, actorEmail: string): Promise<void> {
    const [existing] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
    if (!existing) {
      throw new NotFoundError(`Membership plan '${planId}' not found`);
    }

    try {
      await db.delete(membershipPlans).where(eq(membershipPlans.id, planId));

      await db.insert(auditLogs).values({
        actorEmail,
        action: 'delete_membership_plan',
        entity: 'membership_plan',
        entityId: planId,
        previousValue: {
          name: existing.name,
          durationDays: existing.durationDays,
          price: existing.price,
        },
        reason: `Admin deleted membership package '${existing.name}'`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('foreign key') || msg.includes('violates foreign key constraint')) {
        throw new ValidationError(
          `Cannot delete package '${existing.name}' because student subscriptions or payment history are linked to it. Please deactivate the package instead.`
        );
      }
      throw err;
    }
  }
}

export const membershipService = new MembershipService();
