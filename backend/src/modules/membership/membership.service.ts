import { eq, and, desc, asc, sql, lte, gt } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { membershipPlans, memberships, students, people, auditLogs } from '../../db/schema/index.js';
import { MembershipPlanDto, UserMembershipDto, createPlanSchema, updatePlanSchema } from './membership.types.js';

export class MembershipService {
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
  public async getMyMembership(studentId: string): Promise<{
    activeMembership: UserMembershipDto | null;
    history: UserMembershipDto[];
  }> {
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
      const end = new Date(r.membership.endDate);
      const isCurrentlyActive = r.membership.status === 'active' && end >= now;
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
   * Activate or extend a membership pass for a student (FR-MEM-002)
   */
  public async activateMembership(studentId: string, planId: string, paymentId?: string): Promise<UserMembershipDto> {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);

    if (!plan) {
      throw new NotFoundError(`Membership plan '${planId}' not found`);
    }

    const now = new Date();

    // Check if student has an existing active pass
    const [currentActive] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.studentId, studentId),
          eq(memberships.status, 'active'),
          gt(memberships.endDate, now)
        )
      )
      .orderBy(desc(memberships.endDate))
      .limit(1);

    let startDate = now;
    if (currentActive && new Date(currentActive.endDate) > now) {
      // Chain extension from current expiry date
      startDate = new Date(currentActive.endDate);
    }

    const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

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

    logger.info({ studentId, planId, startDate, endDate }, 'Membership pass activated successfully');

    const msDiff = endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

    return {
      id: inserted.id,
      studentId: inserted.studentId,
      planId: inserted.planId,
      planName: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      status: inserted.status,
      startDate: inserted.startDate.toISOString(),
      endDate: inserted.endDate.toISOString(),
      daysRemaining,
      isActive: true,
      paymentId: inserted.paymentId || undefined,
      createdAt: inserted.createdAt.toISOString(),
    };
  }

  /**
   * Background expiry worker: Mark ended passes as expired
   */
  public async runDailyMembershipExpiryCheck(): Promise<{ expiredCount: number }> {
    const now = new Date();

    const expired = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.status, 'active'), lte(memberships.endDate, now)));

    let expiredCount = 0;

    for (const m of expired) {
      await db
        .update(memberships)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(memberships.id, m.id));
      expiredCount++;
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
}

export const membershipService = new MembershipService();
