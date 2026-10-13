import { eq } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { config } from '../../config/index.js';
import { students, people } from '../../db/schema/index.js';

/**
 * Bring everyone that is already in ZKBio (through the Gym API) into the gym app so the
 * admin pages show them. This only READS from ZKBio. Nothing is ever written back to ZKBio
 * for these people (they are marked source = 'zkbio').
 */

interface ApiRow {
  roll_no: string;
  name?: string | null;
  phone?: string | null;
  residency?: string | null;
  gender?: string | null;
  dept_code?: string | number | null;
}

export interface ZkbioImportResult {
  apiPeople: number;
  created: number;
  updated: number;
  unchanged: number;
  byCategory: Record<string, number>;
}

const CHUNK = 300;

function placement(row: ApiRow): { residency: 'hosteller' | 'day_scholar'; gender: 'male' | 'female'; other: boolean } {
  const dept = String(row.dept_code ?? '');
  if (dept === config.ZKBIO_DEPT_HOSTELLER_GIRLS) return { residency: 'hosteller', gender: 'female', other: false };
  if (dept === config.ZKBIO_DEPT_HOSTELLER_BOYS) return { residency: 'hosteller', gender: 'male', other: false };
  if (dept === config.ZKBIO_DEPT_DAY_SCHOLAR_GIRLS) return { residency: 'day_scholar', gender: 'female', other: false };
  if (dept === config.ZKBIO_DEPT_DAY_SCHOLAR_BOYS) return { residency: 'day_scholar', gender: 'male', other: false };
  const gender = row.gender === 'female' ? 'female' : 'male';
  if (row.residency === 'hosteller' || row.residency === 'day_scholar') {
    return { residency: row.residency, gender, other: false };
  }
  // Staff, faculty, admin and anyone else that is not in a student department.
  return { residency: 'day_scholar', gender, other: true };
}

/** 2024CS001 -> 2024, 241001075 -> 2024. Falls back to this year when the roll number says nothing. */
function joiningYearFromRoll(roll: string): number {
  const now = new Date().getFullYear();
  const four = roll.match(/^(20\d{2})/);
  if (four) return Number(four[1]);
  const two = roll.match(/^(\d{2})\d{4,}/);
  if (two) {
    const y = 2000 + Number(two[1]);
    if (y >= 2010 && y <= now + 1) return y;
  }
  return now;
}

const placeholderEmail = (roll: string) => `${roll.toLowerCase().replace(/[^a-z0-9._-]/g, '_')}@zkbio.import`;

async function fetchApiPeople(): Promise<ApiRow[]> {
  const res = await fetch(`${config.API_APP_URL.replace(/\/+$/, '')}/api/students?limit=100000`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Gym API returned HTTP ${res.status}`);
  return (await res.json()) as ApiRow[];
}

export async function importFromZkbio(): Promise<ZkbioImportResult> {
  const rows = (await fetchApiPeople()).filter((r) => r.roll_no && String(r.roll_no).trim());

  const local = await db
    .select({
      rollNumber: students.rollNumber,
      source: students.source,
      personId: people.id,
      name: people.name,
      phone: people.phone,
    })
    .from(students)
    .innerJoin(people, eq(students.personId, people.id));
  const byRoll = new Map(local.map((r) => [r.rollNumber.toLowerCase(), r]));
  const usedEmails = new Set((await db.select({ email: people.email }).from(people)).map((r) => r.email.toLowerCase()));

  const result: ZkbioImportResult = { apiPeople: rows.length, created: 0, updated: 0, unchanged: 0, byCategory: {} };
  const fresh: Array<{ row: ApiRow; email: string }> = [];

  for (const row of rows) {
    const roll = String(row.roll_no).trim();
    const name = (row.name || roll).trim().slice(0, 255);
    const phone = row.phone ? String(row.phone).slice(0, 20) : null;
    const existing = byRoll.get(roll.toLowerCase());

    if (existing) {
      // People added in the gym app are left exactly as they are.
      if (existing.source === 'zkbio' && (existing.name !== name || (existing.phone ?? null) !== phone)) {
        await db.update(people).set({ name, phone, updatedAt: new Date() }).where(eq(people.id, existing.personId));
        result.updated++;
      } else {
        result.unchanged++;
      }
      continue;
    }

    let email = placeholderEmail(roll);
    for (let n = 2; usedEmails.has(email); n++) email = placeholderEmail(roll).replace('@', `+${n}@`);
    usedEmails.add(email);
    fresh.push({ row: { ...row, roll_no: roll, name, phone }, email });
  }

  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK);
    await db.transaction(async (tx) => {
      const created = await tx
        .insert(people)
        .values(
          chunk.map(({ row, email }) => ({
            name: row.name as string,
            email,
            phone: (row.phone as string | null) ?? null,
            personType: 'student',
            status: 'active',
            faceEnrollmentStatus: 'on_zkbio',
          }))
        )
        .returning({ id: people.id, email: people.email });
      const idByEmail = new Map(created.map((c) => [c.email, c.id]));

      await tx.insert(students).values(
        chunk.map(({ row, email }) => {
          const p = placement(row);
          const category = p.other ? 'other' : `${p.residency}_${p.gender === 'female' ? 'girls' : 'boys'}`;
          result.byCategory[category] = (result.byCategory[category] ?? 0) + 1;
          return {
            personId: idByEmail.get(email) as string,
            rollNumber: row.roll_no,
            department: 'Not provided (from ZKBio)',
            joiningYear: p.other ? new Date().getFullYear() : joiningYearFromRoll(row.roll_no),
            residency: p.residency,
            gender: p.gender,
            faceEnrollmentStatus: 'on_zkbio',
            source: 'zkbio',
            category,
          };
        })
      );
    });
    result.created += chunk.length;
  }

  logger.info(result, 'Imported people from ZKBio into the gym app (read-only, ZKBio unchanged)');
  return result;
}
