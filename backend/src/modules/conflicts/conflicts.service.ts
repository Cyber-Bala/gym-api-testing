import { eq, desc } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { entryExitLogs, people, auditLogs } from '../../db/schema/index.js';
import { ConflictItemDto } from './conflicts.types.js';

export class ConflictsService {
  /**
   * List all turnstile access conflicts & security denials (SRS CON-001)
   */
  public async listConflicts(): Promise<ConflictItemDto[]> {
    const denials = await db
      .select({
        log: entryExitLogs,
        person: people,
      })
      .from(entryExitLogs)
      .leftJoin(people, eq(entryExitLogs.personId, people.id))
      .where(eq(entryExitLogs.result, 'denied'))
      .orderBy(desc(entryExitLogs.createdAt))
      .limit(50);

    return denials.map((d) => ({
      id: d.log.id,
      personId: d.log.personId || undefined,
      name: d.person?.name || 'Unregistered Identifier',
      eventType: d.log.eventType,
      deviceId: d.log.deviceId,
      result: d.log.result,
      denialReason: d.log.denialReason || 'Access Denied',
      status: 'open',
      createdAt: d.log.createdAt.toISOString(),
    }));
  }

  /**
   * Resolve an access conflict (SRS CON-004)
   */
  public async resolveConflict(conflictId: string, resolution: string, notes: string, adminEmail: string) {
    const [existing] = await db.select().from(entryExitLogs).where(eq(entryExitLogs.id, conflictId)).limit(1);

    if (!existing) {
      throw new NotFoundError(`Conflict log '${conflictId}' not found`);
    }

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'resolve_turnstile_conflict',
      entity: 'access_conflict',
      entityId: conflictId,
      reason: `${resolution.toUpperCase()}: ${notes}`,
    });

    logger.info({ conflictId, resolution, adminEmail }, 'Turnstile conflict resolved');

    return {
      conflictId,
      status: 'resolved',
      resolution,
      notes,
      resolvedAt: new Date().toISOString(),
    };
  }
}

export const conflictsService = new ConflictsService();
