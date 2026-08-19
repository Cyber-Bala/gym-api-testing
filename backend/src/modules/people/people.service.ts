import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { eq, ilike, or, and, sql, desc, count } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../../shared/database/index.js';
import { s3Client } from '../../shared/storage/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors/index.js';
import { people, students, staff, authorizedPersons, accounts, auditLogs } from '../../db/schema/index.js';
import {
  studentRowSchema,
  staffRowSchema,
  authorizedPersonSchema,
  StudentRowInput,
  StaffRowInput,
  AuthorizedPersonInput,
  IngestionResultReport,
  RowValidationError,
  StudentFilterQuery,
} from './people.types.js';

export class PeopleService {
  /**
   * Generate downloadable standard Excel template for student onboarding (FR-STU-002)
   */
  public generateStudentTemplateBuffer(): Buffer {
    const sampleData = [
      {
        'Roll Number': '2024CS001',
        'Full Name': 'Karthik Raja',
        'College Email': 'karthik.24cs@rajalakshmi.edu.in',
        'Phone Number': '+919876543210',
        Department: 'Computer Science and Engineering',
        'Joining Year': 2024,
        'Residency (hosteller / day_scholar)': 'hosteller',
        'Emergency Contact': '+919876500001',
        Address: 'Hostel Block A, Room 302',
        'Health Concerns': 'None',
      },
      {
        'Roll Number': '2024IT042',
        'Full Name': 'Priya Sharma',
        'College Email': 'priya.24it@rajalakshmi.edu.in',
        'Phone Number': '+919876543211',
        Department: 'Information Technology',
        'Joining Year': 2024,
        'Residency (hosteller / day_scholar)': 'day_scholar',
        'Emergency Contact': '+919876500002',
        Address: 'Anna Nagar, Chennai',
        'Health Concerns': 'Asthma (mild)',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Auto-fit column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 22 },
      { wch: 32 },
      { wch: 18 },
      { wch: 32 },
      { wch: 14 },
      { wch: 32 },
      { wch: 20 },
      { wch: 30 },
      { wch: 25 },
    ];

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buf as Buffer;
  }

  /**
   * Generate downloadable standard Excel template for staff onboarding
   */
  public generateStaffTemplateBuffer(): Buffer {
    const sampleData = [
      {
        'Staff ID': 'REC-FAC-108',
        'Full Name': 'Dr. S. Ramesh',
        'College Email': 'ramesh.s@rajalakshmi.edu.in',
        'Phone Number': '+919876543213',
        Department: 'Physical Education',
        Designation: 'Sports Coordinator & Assistant Professor',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff');

    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 32 },
      { wch: 18 },
      { wch: 28 },
      { wch: 38 },
    ];

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buf as Buffer;
  }

  /**
   * Generate pre-signed S3/MinIO upload URL for direct browser uploads
   */
  public async getPresignedUploadUrl(
    fileName: string,
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ): Promise<{ uploadUrl: string; fileKey: string; bucket: string }> {
    const bucket = config.MINIO_BUCKET_UPLOADS;
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `imports/${Date.now()}-${uuidv4().slice(0, 8)}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return { uploadUrl, fileKey, bucket };
  }

  /**
   * Parse uploaded Excel buffer to raw row objects
   */
  public parseExcelBuffer(buffer: Buffer): Record<string, unknown>[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new ValidationError('Excel file has no sheets');
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: '' });
      return rows;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ValidationError(`Failed to parse Excel file: ${msg}`);
    }
  }

  /**
   * Normalize student column names from various Excel headers
   */
  private normalizeStudentRow(row: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const strVal = typeof val === 'string' ? val.trim() : val;

      if (cleanKey.includes('roll') || cleanKey.includes('regno')) normalized.rollNumber = strVal;
      else if (cleanKey.includes('name')) normalized.name = strVal;
      else if (cleanKey.includes('email')) normalized.email = strVal;
      else if (cleanKey.includes('phone') || cleanKey.includes('mobile')) normalized.phone = strVal;
      else if (cleanKey.includes('dept') || cleanKey.includes('department')) normalized.department = strVal;
      else if (cleanKey.includes('year') || cleanKey.includes('batch')) normalized.joiningYear = strVal;
      else if (cleanKey.includes('residency') || cleanKey.includes('hostel') || cleanKey.includes('dayscholar')) {
        const resStr = String(strVal).toLowerCase();
        normalized.residency = resStr.includes('hostel') ? 'hosteller' : 'day_scholar';
      } else if (cleanKey.includes('emergency')) normalized.emergencyContact = strVal;
      else if (cleanKey.includes('address')) normalized.address = strVal;
      else if (cleanKey.includes('health')) normalized.healthConcerns = strVal;
    }

    return normalized;
  }

  /**
   * Process and provision student Excel records (FR-STU-001..004)
   */
  public async processStudentRows(rawRows: Record<string, unknown>[]): Promise<IngestionResultReport> {
    const totalRows = rawRows.length;
    const errors: RowValidationError[] = [];
    const successfulIds: string[] = [];

    if (totalRows === 0) {
      return { totalRows: 0, successfulRows: 0, failedRows: 0, errors: [], successfulIds: [] };
    }

    const seenRollNumbersInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();

    for (let index = 0; index < rawRows.length; index++) {
      const rowNum = index + 2; // Row number in Excel (header = 1)
      const raw = rawRows[index];
      const normalized = this.normalizeStudentRow(raw);

      // 1. Schema validation
      const parseResult = studentRowSchema.safeParse(normalized);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        errors.push({
          row: rowNum,
          identifier: String(normalized.rollNumber || normalized.email || 'N/A'),
          reason: `Validation error: ${errorMsg}`,
        });
        continue;
      }

      const rowData: StudentRowInput = parseResult.data;

      // 2. Intra-batch duplicate check
      if (seenRollNumbersInBatch.has(rowData.rollNumber.toLowerCase())) {
        errors.push({
          row: rowNum,
          identifier: rowData.rollNumber,
          reason: `Duplicate Roll Number '${rowData.rollNumber}' detected within this file`,
        });
        continue;
      }
      if (seenEmailsInBatch.has(rowData.email.toLowerCase())) {
        errors.push({
          row: rowNum,
          identifier: rowData.email,
          reason: `Duplicate Email '${rowData.email}' detected within this file`,
        });
        continue;
      }

      seenRollNumbersInBatch.add(rowData.rollNumber.toLowerCase());
      seenEmailsInBatch.add(rowData.email.toLowerCase());

      // 3. Database existence check and transactional provisioning
      try {
        // Check existing student
        const [existingStudent] = await db
          .select({ id: students.id })
          .from(students)
          .where(eq(students.rollNumber, rowData.rollNumber))
          .limit(1);

        if (existingStudent) {
          errors.push({
            row: rowNum,
            identifier: rowData.rollNumber,
            reason: `Roll Number '${rowData.rollNumber}' is already registered in the system`,
          });
          continue;
        }

        // Check existing person email
        const [existingPerson] = await db
          .select({ id: people.id })
          .from(people)
          .where(eq(people.email, rowData.email))
          .limit(1);

        if (existingPerson) {
          errors.push({
            row: rowNum,
            identifier: rowData.email,
            reason: `Email '${rowData.email}' is already registered with another user`,
          });
          continue;
        }

        // 4. Provision Account, Person, and Student records
        const [newAccount] = await db
          .insert(accounts)
          .values({
            email: rowData.email,
            role: 'student',
            isActive: true,
          })
          .returning();

        const [newPerson] = await db
          .insert(people)
          .values({
            accountId: newAccount.id,
            name: rowData.name,
            email: rowData.email,
            phone: rowData.phone || null,
            personType: 'student',
            status: 'active',
          })
          .returning();

        const [newStudent] = await db
          .insert(students)
          .values({
            personId: newPerson.id,
            rollNumber: rowData.rollNumber,
            department: rowData.department,
            joiningYear: rowData.joiningYear,
            residency: rowData.residency,
            faceEnrollmentStatus: 'not_enrolled',
            emergencyContact: rowData.emergencyContact || null,
            address: rowData.address || null,
            healthConcerns: rowData.healthConcerns || null,
          })
          .returning();

        successfulIds.push(newStudent.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err, rowData }, 'Failed to insert student record');
        errors.push({
          row: rowNum,
          identifier: rowData.rollNumber,
          reason: `Database error: ${msg}`,
        });
      }
    }

    return {
      totalRows,
      successfulRows: successfulIds.length,
      failedRows: errors.length,
      errors,
      successfulIds,
    };
  }

  /**
   * Process and provision staff Excel records
   */
  public async processStaffRows(rawRows: Record<string, unknown>[]): Promise<IngestionResultReport> {
    const totalRows = rawRows.length;
    const errors: RowValidationError[] = [];
    const successfulIds: string[] = [];

    for (let index = 0; index < rawRows.length; index++) {
      const rowNum = index + 2;
      const raw = rawRows[index];

      // Normalize fields
      const normalized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(raw)) {
        const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const strVal = typeof val === 'string' ? val.trim() : val;
        if (cleanKey.includes('id') || cleanKey.includes('code')) normalized.staffId = strVal;
        else if (cleanKey.includes('name')) normalized.name = strVal;
        else if (cleanKey.includes('email')) normalized.email = strVal;
        else if (cleanKey.includes('phone')) normalized.phone = strVal;
        else if (cleanKey.includes('dept')) normalized.department = strVal;
        else if (cleanKey.includes('desig')) normalized.designation = strVal;
      }

      const parseResult = staffRowSchema.safeParse(normalized);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        errors.push({
          row: rowNum,
          identifier: String(normalized.staffId || normalized.email || 'N/A'),
          reason: `Validation error: ${errorMsg}`,
        });
        continue;
      }

      const rowData: StaffRowInput = parseResult.data;

      try {
        const [existingStaff] = await db
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.staffId, rowData.staffId))
          .limit(1);

        if (existingStaff) {
          errors.push({
            row: rowNum,
            identifier: rowData.staffId,
            reason: `Staff ID '${rowData.staffId}' is already registered`,
          });
          continue;
        }

        const [newAccount] = await db
          .insert(accounts)
          .values({
            email: rowData.email,
            role: 'staff',
            isActive: true,
          })
          .returning();

        const [newPerson] = await db
          .insert(people)
          .values({
            accountId: newAccount.id,
            name: rowData.name,
            email: rowData.email,
            phone: rowData.phone || null,
            personType: 'staff',
            status: 'active',
          })
          .returning();

        const [newStaff] = await db
          .insert(staff)
          .values({
            personId: newPerson.id,
            staffId: rowData.staffId,
            department: rowData.department,
            designation: rowData.designation || null,
          })
          .returning();

        successfulIds.push(newStaff.id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
          row: rowNum,
          identifier: rowData.staffId,
          reason: `Database error: ${msg}`,
        });
      }
    }

    return {
      totalRows,
      successfulRows: successfulIds.length,
      failedRows: errors.length,
      errors,
      successfulIds,
    };
  }

  /**
   * Paginated student query with filtering and search (FR-SEARCH-001..003)
   */
  public async getStudentsList(query: StudentFilterQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.search) {
      const searchPattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(people.name, searchPattern),
          ilike(students.rollNumber, searchPattern),
          ilike(people.email, searchPattern)
        )
      );
    }

    if (query.department) {
      conditions.push(ilike(students.department, `%${query.department}%`));
    }

    if (query.residency) {
      conditions.push(eq(students.residency, query.residency));
    }

    if (query.isBanned !== undefined) {
      conditions.push(eq(students.isBanned, query.isBanned));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalCountResult] = await db
      .select({ count: count() })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(whereClause);

    const total = Number(totalCountResult?.count || 0);

    const items = await db
      .select({
        id: students.id,
        personId: people.id,
        rollNumber: students.rollNumber,
        name: people.name,
        email: people.email,
        phone: people.phone,
        department: students.department,
        joiningYear: students.joiningYear,
        residency: students.residency,
        faceEnrollmentStatus: students.faceEnrollmentStatus,
        isBanned: students.isBanned,
        violationCount: students.violationCount,
        status: people.status,
        createdAt: students.createdAt,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(whereClause)
      .orderBy(desc(students.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List all authorized persons (FR-AUTH-001..006)
   */
  public async getAuthorizedPersonsList() {
    return await db
      .select({
        id: authorizedPersons.id,
        personId: people.id,
        name: people.name,
        email: people.email,
        phone: people.phone,
        designation: authorizedPersons.designation,
        notes: authorizedPersons.notes,
        status: people.status,
        revokedAt: authorizedPersons.revokedAt,
        createdAt: authorizedPersons.createdAt,
      })
      .from(authorizedPersons)
      .innerJoin(people, eq(authorizedPersons.personId, people.id))
      .orderBy(desc(authorizedPersons.createdAt));
  }

  /**
   * Create an authorized person (Owner, VIP, Contractor)
   */
  public async createAuthorizedPerson(
    input: AuthorizedPersonInput,
    adminEmail: string
  ) {
    const parseResult = authorizedPersonSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError('Invalid authorized person data', parseResult.error.format());
    }

    const data = parseResult.data;

    const [existing] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.email, data.email))
      .limit(1);

    if (existing) {
      throw new ConflictError(`Email '${data.email}' already exists`);
    }

    const [newAccount] = await db
      .insert(accounts)
      .values({
        email: data.email,
        role: 'authorized_person',
        isActive: true,
      })
      .returning();

    const [newPerson] = await db
      .insert(people)
      .values({
        accountId: newAccount.id,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        personType: 'authorized_person',
        status: 'active',
      })
      .returning();

    const [newAuthPerson] = await db
      .insert(authorizedPersons)
      .values({
        personId: newPerson.id,
        designation: data.designation,
        notes: data.notes || null,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'create',
      entity: 'authorized_person',
      entityId: newAuthPerson.id,
      newValue: { ...data, personId: newPerson.id },
      reason: `Provisioned authorized person '${data.name}' (${data.designation})`,
    });

    return newAuthPerson;
  }

  /**
   * Revoke an authorized person's access immediately (FR-AUTH-006)
   */
  public async revokeAuthorizedPerson(id: string, reason: string, adminEmail: string) {
    const [authPerson] = await db
      .select()
      .from(authorizedPersons)
      .where(eq(authorizedPersons.id, id))
      .limit(1);

    if (!authPerson) {
      throw new NotFoundError('Authorized person record not found');
    }

    // Mark inactive in people table
    await db
      .update(people)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(people.id, authPerson.personId));

    // Update revocation timestamp
    const [updated] = await db
      .update(authorizedPersons)
      .set({ revokedAt: new Date() })
      .where(eq(authorizedPersons.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'revoke',
      entity: 'authorized_person',
      entityId: id,
      reason: reason || 'Administrative access revocation',
    });

    return updated;
  }
}

export const peopleService = new PeopleService();
