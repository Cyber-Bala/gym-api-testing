import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { redis } from '../../shared/redis/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/logging/index.js';
import { UnauthorizedError } from '../../shared/errors/index.js';
import { accounts, oauthProviders, people, students, staff, authorizedPersons, adminProfiles, roles } from '../../db/schema/index.js';
import { UserRole, SessionUser, SessionData, GoogleTokenPayload, AuthResponse } from './auth.types.js';

export class AuthService {
  /**
   * Determine session TTL in seconds based on user role (ADR-006 & Plan)
   */
  public getRoleSessionTtlSeconds(role: UserRole): number {
    switch (role) {
      case 'super_admin':
        return 4 * 60 * 60; // 4 hours
      case 'admin':
        return 8 * 60 * 60; // 8 hours
      case 'trainer':
        return 3 * 24 * 60 * 60; // 3 days
      case 'student':
      case 'staff':
      case 'authorized_person':
      default:
        return 7 * 24 * 60 * 60; // 7 days
    }
  }

  /**
   * Verify Google OAuth ID Token
   */
  public async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload> {
    if (!idToken) {
      throw new UnauthorizedError('Google ID token is required');
    }

    // Mock verification for local/test environments
    if (config.NODE_ENV !== 'production' && (idToken.startsWith('mock_token_') || idToken.startsWith('test_token_'))) {
      const email = idToken.replace(/^(mock_token_|test_token_)/, '');
      return {
        email: email.toLowerCase(),
        email_verified: true,
        name: email.split('@')[0],
        sub: `mock_google_sub_${email}`,
      };
    }

    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!response.ok) {
        throw new Error(`Google token validation failed: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;

      if (!payload.email || typeof payload.email !== 'string') {
        throw new Error('Google token does not contain a valid email address');
      }

      return {
        email: (payload.email as string).toLowerCase(),
        email_verified: payload.email_verified === 'true' || payload.email_verified === true,
        name: (payload.name as string) || (payload.email as string).split('@')[0],
        picture: payload.picture as string | undefined,
        sub: payload.sub as string,
      };
    } catch (err: unknown) {
      logger.warn({ err }, 'Google ID Token verification failed');
      throw new UnauthorizedError('Invalid Google identity token');
    }
  }

  /**
   * Look up pre-provisioned person record from database and build SessionUser
   */
  public async findAndSyncProvisionedUser(email: string, googleSub?: string): Promise<SessionUser> {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if person is provisioned in people table
    const [personRecord] = await db
      .select()
      .from(people)
      .where(eq(people.email, normalizedEmail))
      .limit(1);

    if (!personRecord) {
      throw new UnauthorizedError(
        `Email '${normalizedEmail}' is not provisioned. Only students and staff registered by the college can sign in.`
      );
    }

    if (personRecord.status !== 'active') {
      throw new UnauthorizedError(
        `Account for '${normalizedEmail}' is currently marked as ${personRecord.status}. Access denied.`
      );
    }

    // 2. Ensure linked account exists in identity.accounts
    let accountRecord: typeof accounts.$inferSelect | undefined;

    if (personRecord.accountId) {
      const [acc] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, personRecord.accountId))
        .limit(1);
      accountRecord = acc;
    }

    if (!accountRecord) {
      // Create new identity account for this provisioned person
      const [newAccount] = await db
        .insert(accounts)
        .values({
          email: normalizedEmail,
          role: personRecord.personType,
          isActive: true,
          lastLoginAt: new Date(),
        })
        .returning();

      accountRecord = newAccount;

      // Link to person record
      await db
        .update(people)
        .set({ accountId: newAccount.id, updatedAt: new Date() })
        .where(eq(people.id, personRecord.id));
    } else {
      // Update last login
      await db
        .update(accounts)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(accounts.id, accountRecord.id));
    }

    // 3. Link Google OAuth provider if sub provided
    if (googleSub) {
      const [existingOAuth] = await db
        .select()
        .from(oauthProviders)
        .where(eq(oauthProviders.providerUserId, googleSub))
        .limit(1);

      if (!existingOAuth) {
        await db.insert(oauthProviders).values({
          accountId: accountRecord.id,
          provider: 'google',
          providerUserId: googleSub,
          profileData: { email: normalizedEmail },
        });
      }
    }

    // 4. Determine permissions & role-specific details
    let userRole: UserRole = (accountRecord.role as UserRole) || 'student';
    let permissions: string[] = [];
    let isProtectedSuperAdmin = false;

    // Check if admin profile exists
    const [adminProfile] = await db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.accountId, accountRecord.id))
      .limit(1);

    if (adminProfile) {
      isProtectedSuperAdmin = adminProfile.isProtectedSuperAdmin === 'true';
      if (isProtectedSuperAdmin) {
        userRole = 'super_admin';
        permissions = ['*']; // All capabilities
      } else if (adminProfile.roleId) {
        const [roleRecord] = await db
          .select()
          .from(roles)
          .where(eq(roles.id, adminProfile.roleId))
          .limit(1);
        if (roleRecord && Array.isArray(roleRecord.permissions)) {
          permissions = roleRecord.permissions as string[];
        }
      }
    }

    // Load student details if applicable
    let studentDetails: SessionUser['studentDetails'];
    if (personRecord.personType === 'student') {
      const [studentRec] = await db
        .select()
        .from(students)
        .where(eq(students.personId, personRecord.id))
        .limit(1);
if (studentRec) {
        studentDetails = {
          rollNumber: studentRec.rollNumber,
          department: studentRec.department,
          joiningYear: studentRec.joiningYear,
          residency: studentRec.residency,
          isBanned: studentRec.isBanned,
          violationCount: studentRec.violationCount,
          phone: personRecord.phone || null,
          emergencyContact: studentRec.emergencyContact || null,
          address: studentRec.address || null,
          healthConcerns: studentRec.healthConcerns || null,
        };
      }
    }

    // Load staff details if applicable
    let staffDetails: SessionUser['staffDetails'];
    if (personRecord.personType === 'staff') {
      const [staffRec] = await db
        .select()
        .from(staff)
        .where(eq(staff.personId, personRecord.id))
        .limit(1);
      if (staffRec) {
        staffDetails = {
          staffId: staffRec.staffId,
          department: staffRec.department,
        };
      }
    }

    return {
      accountId: accountRecord.id,
      personId: personRecord.id,
      email: normalizedEmail,
      name: personRecord.name,
      role: userRole,
      personType: personRecord.personType,
      status: personRecord.status,
      permissions,
      isProtectedSuperAdmin,
      studentDetails,
      staffDetails,
    };
  }

  /**
   * Create and persist a Redis session
   */
  public async createSession(
    user: SessionUser,
    reqContext: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthResponse & { sessionId: string }> {
    const sessionId = uuidv4();
    const ttlSeconds = this.getRoleSessionTtlSeconds(user.role);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const sessionData: SessionData = {
      id: sessionId,
      user,
      userAgent: reqContext.userAgent,
      ipAddress: reqContext.ipAddress,
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt,
    };

    // Store in Redis with TTL
    const sessionKey = `session:${sessionId}`;
    await redis.set(sessionKey, JSON.stringify(sessionData), 'EX', ttlSeconds);

    // Track session under user's set
    const userSessionsKey = `user_sessions:${user.accountId}`;
    await redis.sadd(userSessionsKey, sessionId);
    await redis.expire(userSessionsKey, 30 * 24 * 60 * 60); // 30 days index retention

    logger.info(
      { accountId: user.accountId, email: user.email, role: user.role, sessionId },
      'User session created successfully'
    );

    return {
      sessionId,
      user,
      expiresAt,
    };
  }

  /**
   * Fetch active session from Redis
   */
  public async getSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) return null;
    const sessionKey = `session:${sessionId}`;
    const raw = await redis.get(sessionKey);
    if (!raw) return null;

    try {
      const sessionData = JSON.parse(raw) as SessionData;
      return sessionData;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate a single session
   */
  public async destroySession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    const session = await this.getSession(sessionId);
    if (session) {
      const userSessionsKey = `user_sessions:${session.user.accountId}`;
      await redis.srem(userSessionsKey, sessionId);
    }
    await redis.del(`session:${sessionId}`);
  }

  /**
   * Invalidate all sessions for a user (e.g., Logout all devices / Deactivation)
   */
  public async destroyAllUserSessions(accountId: string): Promise<void> {
    if (!accountId) return;
    const userSessionsKey = `user_sessions:${accountId}`;
    const sessionIds = await redis.smembers(userSessionsKey);

    if (sessionIds && sessionIds.length > 0) {
      const pipeline = redis.pipeline();
      for (const id of sessionIds) {
        pipeline.del(`session:${id}`);
      }
      pipeline.del(userSessionsKey);
      await pipeline.exec();
    }
  }
}

export const authService = new AuthService();
