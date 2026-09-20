import { Router } from 'express';
import {
  downloadTemplate,
  getUploadUrl,
  importStudents,
  createStudent,
  importStaff,
  listStudents,
  listAuthorizedPersons,
  createAuthorizedPerson,
  revokeAuthorizedPerson,
  updateMyStudentProfile,
  setStudentTrainerRole,
  bulkSetTrainerRoles,
  updateStudentResidency,
} from './people.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const peopleRouter = Router();

// Public / Authenticated template downloads
peopleRouter.get('/template/:type', downloadTemplate);

// Protected routes (Admin & Trainer)
peopleRouter.use(requireAuth);

// Student self-onboarding profile update
peopleRouter.patch('/students/me', updateMyStudentProfile);

// Student queries & single creation
peopleRouter.get('/students', requireRole(['admin', 'super_admin', 'trainer']), listStudents);
peopleRouter.post('/students', requireRole(['admin', 'super_admin']), createStudent);
peopleRouter.patch('/students/:id/residency', requireRole(['admin', 'super_admin']), updateStudentResidency);

// Trainer role management (students who are trainers)
peopleRouter.patch('/students/:id/trainer-role', requireRole(['admin', 'super_admin']), setStudentTrainerRole);
peopleRouter.post('/trainers/bulk', requireRole(['admin', 'super_admin']), bulkSetTrainerRoles);

// Ingestion & Presigned URL endpoints (Admin only)
peopleRouter.post('/upload-url', requireRole(['admin', 'super_admin']), getUploadUrl);
peopleRouter.post('/import/students', requireRole(['admin', 'super_admin']), importStudents);
peopleRouter.post('/import/staff', requireRole(['admin', 'super_admin']), importStaff);

// Authorized Persons CRUD (Admin only)
peopleRouter.get('/authorized-persons', requireRole(['admin', 'super_admin']), listAuthorizedPersons);
peopleRouter.post('/authorized-persons', requireRole(['admin', 'super_admin']), createAuthorizedPerson);
peopleRouter.post('/authorized-persons/:id/revoke', requireRole(['admin', 'super_admin']), revokeAuthorizedPerson);
