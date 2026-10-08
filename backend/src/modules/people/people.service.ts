import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { eq, ilike, or, and, not, sql, desc, count } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../../shared/database/index.js';
import { s3Client } from '../../shared/storage/index.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors/index.js';
import {
  people,
  students,
  staff,
  authorizedPersons,
  accounts,
  auditLogs,
  trainerProfiles,
} from '../../db/schema/index.js';
import {
  studentRowSchema,
  staffRowSchema,
  authorizedPersonSchema,
  studentSelfUpdateSchema,
  StudentRowInput,
  StaffRowInput,
  AuthorizedPersonInput,
  StudentSelfUpdateInput,
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
        Department: 'Computer Science and Engineering',
        'Joining Year': 2024,
        'Residency (hosteller / day_scholar)': 'hosteller',
        'Gender (male / female)': 'male',
      },
      {
        'Roll Number': '2024IT042',
        'Full Name': 'Priya Sharma',
        'College Email': 'priya.24it@rajalakshmi.edu.in',
        Department: 'Information Technology',
        'Joining Year': 2024,
        'Residency (hosteller / day_scholar)': 'day_scholar',
        'Gender (male / female)': 'female',
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
      { wch: 32 },
      { wch: 14 },
      { wch: 32 },
      { wch: 24 },
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
   * Helper to push a person directly to ZKBio via api_app
   */
  private async syncPersonToZkbio(
    rollNumber: string,
    name: string,
    phone: string | null,
    residency: string,
    gender: string
  ) {
    let deptCode = '1'; // Default Day Scholar (General)
    if (residency === 'hosteller') {
      deptCode = gender === 'female' ? '2' : '3';
    }

    try {
      const response = await fetch(`${config.API_APP_URL}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          roll_no: rollNumber,
          name: name,
          room_no: 'N/A',
          phone: phone || '',
          dept_code: deptCode,
          residency: residency || undefined,
        }),
      });

      if (!response.ok && response.status !== 400) {
        logger.warn({ rollNumber, status: response.status }, 'Failed to sync student to api_app');
      }
    } catch (err) {
      logger.warn({ err, rollNumber }, 'Could not reach api_app to sync student');
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
      else if (cleanKey.includes('dept') || cleanKey.includes('department')) normalized.department = strVal;
      else if (cleanKey.includes('year') || cleanKey.includes('batch')) normalized.joiningYear = strVal;
      else if (cleanKey.includes('residency') || cleanKey.includes('hostel') || cleanKey.includes('dayscholar')) {
        const resStr = String(strVal).toLowerCase();
        normalized.residency = resStr.includes('hostel') ? 'hosteller' : 'day_scholar';
      }
      else if (cleanKey.includes('gender') || cleanKey.includes('sex')) {
        const genStr = String(strVal).toLowerCase();
        normalized.gender = genStr.includes('female') ? 'female' : 'male';
      }
    }

    return normalized;
  }

/**
   * Process and provision student Excel records (FR-STU-001..004)
   * Existing records are updated by roll number; self-fill fields are never overwritten.
   */
  public async processStudentRows(rawRows: Record<string, unknown>[]): Promise<IngestionResultReport> {
    const totalRows = rawRows.length;
    const errors: RowValidationError[] = [];
    const successfulIds: string[] = [];
    let updatedRows = 0;

    if (totalRows === 0) {
      return { totalRows: 0, successfulRows: 0, updatedRows: 0, failedRows: 0, errors: [], successfulIds: [] };
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

      // 3. Database existence check and provisioning
      try {
        // Check existing student by roll number
        const [existingStudent] = await db
          .select()
          .from(students)
          .where(eq(students.rollNumber, rowData.rollNumber))
          .limit(1);

        if (existingStudent) {
          // --- UPDATE path: refresh directory fields, keep student self-fill data intact ---
          const [existingPerson] = await db
            .select()
            .from(people)
            .where(eq(people.id, existingStudent.personId))
            .limit(1);

          if (!existingPerson) {
            errors.push({
              row: rowNum,
              identifier: rowData.rollNumber,
              reason: 'Student exists but linked person record is missing',
            });
            continue;
          }

          // Email conflict check (email belongs to another person)
          if (rowData.email !== existingPerson.email) {
            const [emailTaken] = await db
              .select({ id: people.id })
              .from(people)
              .where(and(eq(people.email, rowData.email), not(eq(people.id, existingPerson.id))))
              .limit(1);
            if (emailTaken) {
              errors.push({
                row: rowNum,
                identifier: rowData.email,
                reason: `Email '${rowData.email}' is already registered with another user`,
              });
              continue;
            }
          }

          await db
            .update(people)
            .set({ name: rowData.name, email: rowData.email, updatedAt: new Date() })
            .where(eq(people.id, existingPerson.id));

          await db
            .update(students)
            .set({
              department: rowData.department,
              joiningYear: rowData.joiningYear,
              residency: rowData.residency,
              gender: rowData.gender,
              updatedAt: new Date(),
            })
            .where(eq(students.id, existingStudent.id));

          updatedRows++;
          successfulIds.push(existingStudent.id);
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
            gender: rowData.gender,
            faceEnrollmentStatus: 'not_enrolled',
          })
          .returning();

        successfulIds.push(newStudent.id);
        
        // Push to ZKBio device asynchronously
        this.syncPersonToZkbio(
          rowData.rollNumber,
          rowData.name,
          null, // phone not in excel yet
          rowData.residency,
          rowData.gender
        );
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
      updatedRows,
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
    let updatedRows = 0;

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
          .select()
          .from(staff)
          .where(eq(staff.staffId, rowData.staffId))
          .limit(1);

        if (existingStaff) {
          // --- UPDATE path: refresh staff directory fields by Staff ID ---
          const [existingPerson] = await db
            .select()
            .from(people)
            .where(eq(people.id, existingStaff.personId))
            .limit(1);

          if (!existingPerson) {
            errors.push({
              row: rowNum,
              identifier: rowData.staffId,
              reason: 'Staff record exists but linked person record is missing',
            });
            continue;
          }

          if (rowData.email !== existingPerson.email) {
            const [emailTaken] = await db
              .select({ id: people.id })
              .from(people)
              .where(and(eq(people.email, rowData.email), not(eq(people.id, existingPerson.id))))
              .limit(1);
            if (emailTaken) {
              errors.push({
                row: rowNum,
                identifier: rowData.email,
                reason: `Email '${rowData.email}' is already registered with another user`,
              });
              continue;
            }
          }

          await db
            .update(people)
            .set({
              name: rowData.name,
              email: rowData.email,
              phone: rowData.phone || null,
              updatedAt: new Date(),
            })
            .where(eq(people.id, existingPerson.id));

          await db
            .update(staff)
            .set({
              department: rowData.department,
              designation: rowData.designation || null,
            })
            .where(eq(staff.id, existingStaff.id));

          updatedRows++;
          successfulIds.push(existingStaff.id);
          continue;
        }

        // Email conflict check for new records
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
      updatedRows,
      failedRows: errors.length,
      errors,
      successfulIds,
    };
  }

  /**
   * Paginated student query with filtering and search (FR-SEARCH-001..003)
   * Supports residency + gender combined buckets:
   *   day_scholar_boys | day_scholar_girls | hosteller_boys | hosteller_girls
   */
  public async getStudentsList(query: StudentFilterQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    // Resolve combined category into residency + gender (category wins over individual fields)
    let residency = query.residency;
    let gender = query.gender;
    if (query.category) {
      switch (query.category) {
        case 'day_scholar_boys':
          residency = 'day_scholar';
          gender = 'male';
          break;
        case 'day_scholar_girls':
          residency = 'day_scholar';
          gender = 'female';
          break;
        case 'hosteller_boys':
          residency = 'hosteller';
          gender = 'male';
          break;
        case 'hosteller_girls':
          residency = 'hosteller';
          gender = 'female';
          break;
      }
    }

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

    if (residency) {
      conditions.push(eq(students.residency, residency));
    }

    if (gender) {
      conditions.push(eq(students.gender, gender));
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
        gender: students.gender,
        faceEnrollmentStatus: students.faceEnrollmentStatus,
        isBanned: students.isBanned,
        violationCount: students.violationCount,
        status: people.status,
        createdAt: students.createdAt,
        trainerProfileId: trainerProfiles.id,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .leftJoin(trainerProfiles, eq(trainerProfiles.personId, people.id))
      .where(whereClause)
      .orderBy(desc(students.createdAt))
      .limit(limit)
      .offset(offset);

    // Global 4-bucket breakdown (ignores pagination, respects search/department only)
    // so the admin panel can render Day Scholar Boys/Girls + Hosteller Boys/Girls tabs.
    const breakdownConditions = [];
    if (query.search) {
      const searchPattern = `%${query.search.trim()}%`;
      breakdownConditions.push(
        or(
          ilike(people.name, searchPattern),
          ilike(students.rollNumber, searchPattern),
          ilike(people.email, searchPattern)
        )
      );
    }
    if (query.department) {
      breakdownConditions.push(ilike(students.department, `%${query.department}%`));
    }
    const breakdownWhere = breakdownConditions.length > 0 ? and(...breakdownConditions) : undefined;
    const breakdownRows = await db
      .select({ residency: students.residency, gender: students.gender, count: count() })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(breakdownWhere)
      .groupBy(students.residency, students.gender);

    const breakdown = {
      dayScholarBoys: 0,
      dayScholarGirls: 0,
      hostellerBoys: 0,
      hostellerGirls: 0,
    };
    for (const r of breakdownRows) {
      const n = Number(r.count || 0);
      if (r.residency === 'day_scholar' && r.gender === 'male') breakdown.dayScholarBoys = n;
      else if (r.residency === 'day_scholar' && r.gender === 'female') breakdown.dayScholarGirls = n;
      else if (r.residency === 'hosteller' && r.gender === 'male') breakdown.hostellerBoys = n;
      else if (r.residency === 'hosteller' && r.gender === 'female') breakdown.hostellerGirls = n;
      else if (r.residency === 'day_scholar') breakdown.dayScholarBoys += n;
      else if (r.residency === 'hosteller') breakdown.hostellerBoys += n;
    }

    return {
      items: items.map((row) => ({ ...row, isTrainer: Boolean(row.trainerProfileId) })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      breakdown,
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

  /**
   * Optional student profile fields (phone, emergency contact, address, health)
   */
  public async updateMyStudentProfile(personId: string, input: StudentSelfUpdateInput) {
    const parseResult = studentSelfUpdateSchema.safeParse(input);
    if (!parseResult.success) {
      throw new ValidationError('Invalid profile data', parseResult.error.format());
    }
    const data = parseResult.data;

    const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
    if (!person || person.personType !== 'student') {
      throw new NotFoundError('Student profile not found');
    }

    const [stu] = await db.select().from(students).where(eq(students.personId, personId)).limit(1);
    if (!stu) {
      throw new NotFoundError('Student record not found');
    }

    if (data.phone !== undefined) {
      await db.update(people).set({ phone: data.phone, updatedAt: new Date() }).where(eq(people.id, personId));
    }

    const studentUpdates: Record<string, unknown> = {};
    if (data.emergencyContact !== undefined) studentUpdates.emergencyContact = data.emergencyContact;
    if (data.address !== undefined) studentUpdates.address = data.address;
    if (data.healthConcerns !== undefined) studentUpdates.healthConcerns = data.healthConcerns;
    if (Object.keys(studentUpdates).length > 0) {
      studentUpdates.updatedAt = new Date();
      await db.update(students).set(studentUpdates).where(eq(students.id, stu.id));
    }

    return {
      phone: data.phone ?? person.phone ?? null,
      emergencyContact: data.emergencyContact ?? stu.emergencyContact ?? null,
      address: data.address ?? stu.address ?? null,
      healthConcerns: data.healthConcerns ?? stu.healthConcerns ?? null,
    };
  }

  /**
   * Toggle a student's trainer role. Trainers are students with a trainer profile (FR-TRN-000)
   */
  public async setStudentTrainerRole(studentId: string, isTrainer: boolean, adminEmail: string) {
    const [stu] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!stu) {
      throw new NotFoundError(`Student '${studentId}' not found`);
    }

    const [person] = await db.select().from(people).where(eq(people.id, stu.personId)).limit(1);
    if (!person) {
      throw new NotFoundError('Linked person record not found');
    }

    const [existingProfile] = await db
      .select({ id: trainerProfiles.id })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.personId, stu.personId))
      .limit(1);

    if (isTrainer && !existingProfile) {
      await db.insert(trainerProfiles).values({ personId: stu.personId });
    } else if (!isTrainer && existingProfile) {
      await db.delete(trainerProfiles).where(eq(trainerProfiles.id, existingProfile.id));
    }

    if (person.accountId) {
      await db
        .update(accounts)
        .set({ role: isTrainer ? 'trainer' : 'student', updatedAt: new Date() })
        .where(eq(accounts.id, person.accountId));
    }

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: isTrainer ? 'assign_trainer_role' : 'remove_trainer_role',
      entity: 'trainer_profile',
      entityId: stu.personId,
      previousValue: { isTrainer: Boolean(existingProfile) },
      newValue: { isTrainer },
      reason: isTrainer
        ? `Marked student '${stu.rollNumber}' as trainer`
        : `Removed trainer role from student '${stu.rollNumber}'`,
    });

    return {
      studentId: stu.id,
      rollNumber: stu.rollNumber,
      name: person.name,
      isTrainer,
    };
  }

  /**
   * Bulk assign/remove trainer role by roll numbers (bulk import)
   */
  public async bulkSetTrainerRoles(rollNumbers: string[], action: 'assign' | 'remove', adminEmail: string) {
    const notFound: string[] = [];
    const failed: { rollNumber: string; reason: string }[] = [];
    let assigned = 0;
    let removed = 0;

    for (const roll of rollNumbers) {
      const [stu] = await db
        .select({ id: students.id, rollNumber: students.rollNumber })
        .from(students)
        .where(eq(students.rollNumber, roll))
        .limit(1);

      if (!stu) {
        notFound.push(roll);
        continue;
      }

      try {
        await this.setStudentTrainerRole(stu.id, action === 'assign', adminEmail);
        if (action === 'assign') assigned++;
        else removed++;
      } catch (err: unknown) {
        failed.push({ rollNumber: roll, reason: err instanceof Error ? err.message : String(err) });
      }
    }

    return {
      processed: rollNumbers.length,
      assigned,
      removed,
      notFound,
      failed,
    };
  }

  /**
   * Admin: Add a single student manually
   */
  public async createSingleStudent(data: StudentRowInput, adminEmail: string) {
    // Check if roll number already exists
    const [existingStudent] = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.rollNumber, data.rollNumber))
      .limit(1);

    if (existingStudent) {
      throw new ConflictError(`A student with roll number '${data.rollNumber}' already exists.`);
    }

    // Check if email already exists
    const [existingPerson] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.email, data.email))
      .limit(1);

    if (existingPerson) {
      throw new ConflictError(`Email '${data.email}' is already registered with another user.`);
    }

    // Provision Account, Person, and Student records
    const [newAccount] = await db
      .insert(accounts)
      .values({
        email: data.email,
        role: 'student',
        isActive: true,
      })
      .returning();

    const [newPerson] = await db
      .insert(people)
      .values({
        accountId: newAccount.id,
        name: data.name,
        email: data.email,
        personType: 'student',
        status: 'active',
      })
      .returning();

    const [newStudent] = await db
      .insert(students)
      .values({
        personId: newPerson.id,
        rollNumber: data.rollNumber,
        department: data.department,
        joiningYear: data.joiningYear,
        residency: data.residency,
        gender: data.gender,
        faceEnrollmentStatus: 'not_enrolled',
      })
      .returning();

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'create_single_student',
      entity: 'student',
      entityId: newStudent.id,
      newValue: {
        rollNumber: newStudent.rollNumber,
        name: newPerson.name,
        email: newPerson.email,
        department: newStudent.department,
        joiningYear: newStudent.joiningYear,
        residency: newStudent.residency,
        gender: newStudent.gender,
      },
      reason: `Admin created student '${newStudent.rollNumber}'`,
    });

    // Push single-added student to ZKBio device via api_app (async, best-effort)
    this.syncPersonToZkbio(
      newStudent.rollNumber,
      newPerson.name,
      newPerson.phone || null,
      newStudent.residency,
      newStudent.gender
    );

    return {
      id: newStudent.id,
      personId: newPerson.id,
      rollNumber: newStudent.rollNumber,
      name: newPerson.name,
      email: newPerson.email,
      department: newStudent.department,
      joiningYear: newStudent.joiningYear,
      residency: newStudent.residency,
      gender: newStudent.gender,
      faceEnrollmentStatus: newStudent.faceEnrollmentStatus,
      status: newPerson.status,
      createdAt: newStudent.createdAt.toISOString(),
    };
  }

  /**
   * Admin: update a student's gender (Boys / Girls).
   * Re-syncs the ZKBio dept code for hostellers:
   *   day_scholar -> dept 1 (general), hosteller female -> dept 2, hosteller male -> dept 3
   */
  public async updateStudentGender(
    id: string,
    gender: 'male' | 'female',
    adminEmail: string = 'system'
  ): Promise<void> {
    const [existingStudent] = await db
      .select({
        id: students.id,
        rollNumber: students.rollNumber,
        residency: students.residency,
        gender: students.gender,
        personId: students.personId,
      })
      .from(students)
      .where(eq(students.id, id))
      .limit(1);

    if (!existingStudent) {
      throw new NotFoundError(`Student with ID ${id} not found`);
    }

    await db
      .update(students)
      .set({ gender, updatedAt: new Date() })
      .where(eq(students.id, id));

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'update_student_gender',
      entity: 'student',
      entityId: existingStudent.rollNumber,
      previousValue: { gender: existingStudent.gender },
      newValue: { gender },
      reason: `Admin updated gender for '${existingStudent.rollNumber}' to '${gender}'`,
    });

    // Best-effort re-sync so hosteller boys/girls land in the right device group
    try {
      const [person] = await db
        .select({ name: people.name, phone: people.phone })
        .from(people)
        .where(eq(people.id, existingStudent.personId))
        .limit(1);
      if (person) {
        await this.syncPersonToZkbio(
          existingStudent.rollNumber,
          person.name,
          person.phone,
          existingStudent.residency,
          gender
        );
      }
    } catch (err) {
      logger.warn({ err, rollNumber: existingStudent.rollNumber }, 'Gender re-sync to api_app failed');
    }
  }
  public async updateStudentResidency(
    id: string,
    residency: 'hosteller' | 'day_scholar',
    adminEmail: string = 'system'
  ): Promise<void> {
    const [existingStudent] = await db
      .select({ 
        id: students.id, 
        rollNumber: students.rollNumber,
        residency: students.residency,
        personId: students.personId
      })
      .from(students)
      .where(eq(students.id, id))
      .limit(1);

    if (!existingStudent) {
      throw new NotFoundError(`Student with ID ${id} not found`);
    }

    if (existingStudent.residency === 'hosteller' && residency === 'day_scholar') {
      // 1. Cancel existing bookings
      const { reservationService } = await import('../booking/reservation.service.js');
      const [person] = await db.select({ email: people.email }).from(people).where(eq(people.id, existingStudent.personId));
      if (person) {
        await reservationService.adminCancelAllBookings(person.email, adminEmail);
      }
      
      // 2. Delete his face in the device and tell to register
      // We set faceEnrollmentStatus to not_enrolled to enforce re-registration
      await db
        .update(students)
        .set({ residency, faceEnrollmentStatus: 'not_enrolled', faceReferenceId: null, updatedAt: new Date() })
        .where(eq(students.id, id));

      await db
        .update(people)
        .set({ faceEnrollmentStatus: 'not_enrolled', faceReferenceId: null, updatedAt: new Date() })
        .where(eq(people.id, existingStudent.personId));
        
      try {
         // Revoke access on ZKBio via api_app
         await fetch(`${config.API_APP_URL}/api/students/${existingStudent.rollNumber}/payment`, {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ payment_status: 'expired', payment_valid_from: null, payment_valid_until: null })
         });
      } catch (err) {
         logger.error({ err }, 'Failed to sync access revocation to api_app');
      }

    } else {
      // Day Scholar -> Hosteller (or no change)
      // 1. Don't cancel slots (continue to use as hosteller plan)
      // 2. No delete needed and no need of reregister
      await db
        .update(students)
        .set({ residency, updatedAt: new Date() })
        .where(eq(students.id, id));
    }
  }

  /**
   * Fully delete a student:
   *  1. Cascade delete all related rows from our Postgres DB (bookings, violations,
   *     memberships, payment orders, access sessions, trainer profile, student, person, account)
   *  2. Call api_app DELETE /api/students/{roll_no} which:
   *       a. Revokes access level on the physical ZKBio turnstile device
   *       b. Syncs the device
   *       c. Deletes the student from the api_app SQLite DB
   */
  public async deleteStudent(studentId: string, adminEmail: string): Promise<{ deletedRollNumber: string }> {
    // 1. Resolve student and their associated account ID
    const [stu] = await db
      .select({ 
        id: students.id, 
        personId: students.personId, 
        rollNumber: students.rollNumber,
        accountId: people.accountId
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(eq(students.id, studentId))
      .limit(1);

    if (!stu) {
      throw new NotFoundError(`Student '${studentId}' not found`);
    }

    const rollNumber = stu.rollNumber;

    // 2. Cascade delete from Postgres inside a transaction
    // (All child tables have ON DELETE CASCADE FKs — no manual child deletes needed)
    await db.transaction(async (tx) => {
      // All child tables (bookings, memberships, violations, paymentOrders,
      // accessSessions, trainerProfiles) have ON DELETE CASCADE from their
      // student_id → students.id FK, or person_id → people.id FK.
      // So we just need to:
      //  1. Delete the account (if it exists)
      //  2. Delete the person row → cascades to students → cascades to all child tables

      // Audit log first (before the rows disappear)
      await tx.insert(auditLogs).values({
        action: 'delete',
        actorEmail: adminEmail,
        entity: 'student',
        entityId: rollNumber,
        reason: `Student ${rollNumber} permanently deleted by admin`,
        newValue: { studentId: stu.id, rollNumber },
      });

      // Delete account row if it exists
      if (stu.accountId) {
        await tx.delete(accounts).where(eq(accounts.id, stu.accountId));
      }

      // Delete person → cascades to students → cascades to all child records
      await tx.delete(people).where(eq(people.id, stu.personId));
    });


    logger.info({ rollNumber, adminEmail }, 'Student deleted from Postgres DB');

    // 3. Delete from api_app SQLite DB + ZKBio device (best-effort)
    try {
      const apiAppRes = await fetch(`${config.API_APP_URL}/api/students/${rollNumber}`, {
        method: 'DELETE',
      });

      if (apiAppRes.status === 204 || apiAppRes.status === 404) {
        logger.info({ rollNumber }, 'Student removed from api_app + ZKBio device');
      } else {
        const body = await apiAppRes.text().catch(() => '');
        logger.warn({ rollNumber, status: apiAppRes.status, body }, 'api_app delete returned unexpected status');
      }
    } catch (err) {
      // api_app may be offline (no device connected). Postgres deletion already succeeded.
      logger.warn({ err, rollNumber }, 'Could not reach api_app to delete from device (device may be offline)');
    }

    return { deletedRollNumber: rollNumber };
  }

}

export const peopleService = new PeopleService();
