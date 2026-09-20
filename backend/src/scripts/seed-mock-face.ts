import { eq } from 'drizzle-orm';
import { db } from '../shared/database/index.js';
import { students, people } from '../db/schema/index.js';
import { logger } from '../shared/logging/index.js';

const run = async () => {
  const email = '230701094@rajalakshmi.edu.in';
  
  const [person] = await db.select().from(people).where(eq(people.email, email)).limit(1);
  if (!person) {
    logger.error('Person not found');
    process.exit(1);
  }

  await db.update(people).set({ 
    faceEnrollmentStatus: 'enrolled',
    faceReferenceId: 'zkbio_mock_ref_123'
  }).where(eq(people.id, person.id));

  await db.update(students).set({
    faceEnrollmentStatus: 'enrolled',
    faceReferenceId: 'zkbio_mock_ref_123'
  }).where(eq(students.personId, person.id));

  logger.info(`Successfully updated face registration for ${email} to 'enrolled'`);
  process.exit(0);
};

run().catch(console.error);
