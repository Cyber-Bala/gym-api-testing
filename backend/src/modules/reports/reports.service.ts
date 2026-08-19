import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import {
  people,
  students,
  accessSessions,
  slots,
  paymentOrders,
  membershipPlans,
  violations,
  workShifts,
  trainerProfiles,
  entryExitLogs,
} from '../../db/schema/index.js';
import { GenericReportResultDto } from './reports.types.js';

export class ReportsService {
  /**
   * Multi-domain report generator (SRS REP-001..010)
   */
  public async generateReport(
    reportType: string,
    filters: { startDate?: string; endDate?: string; department?: string; residency?: string }
  ): Promise<GenericReportResultDto> {
    const now = new Date().toISOString();

    switch (reportType) {
      case 'attendance': {
        const data = await db
          .select({
            session: accessSessions,
            person: people,
          })
          .from(accessSessions)
          .innerJoin(people, eq(accessSessions.personId, people.id))
          .orderBy(desc(accessSessions.entryTimestamp))
          .limit(100);

        const rows = data.map((d) => {
          const entry = new Date(d.session.entryTimestamp);
          const exit = d.session.exitTimestamp ? new Date(d.session.exitTimestamp) : null;
          const duration = exit ? Math.max(1, Math.round((exit.getTime() - entry.getTime()) / 60000)) : 'In Progress';

          return {
            'Session ID': d.session.id.slice(0, 8),
            'Name': d.person.name,
            'Email': d.person.email,
            'Role': d.person.personType,
            'Entry Time': entry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            'Exit Time': exit ? exit.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Inside',
            'Duration (Mins)': duration,
            'Date': entry.toLocaleDateString(),
          };
        });

        return {
          reportType: 'Gym Attendance & Check-In Report',
          generatedAt: now,
          totalRecords: rows.length,
          columns: ['Session ID', 'Name', 'Email', 'Role', 'Date', 'Entry Time', 'Exit Time', 'Duration (Mins)'],
          rows,
        };
      }

      case 'revenue': {
        const data = await db
          .select({
            order: paymentOrders,
            plan: membershipPlans,
            person: people,
          })
          .from(paymentOrders)
          .innerJoin(membershipPlans, eq(paymentOrders.planId, membershipPlans.id))
          .innerJoin(people, eq(paymentOrders.studentId, people.id))
          .orderBy(desc(paymentOrders.createdAt))
          .limit(100);

        let totalRevenue = 0;
        const rows = data.map((d) => {
          const amt = parseFloat(d.order.amount);
          if (d.order.status === 'paid') totalRevenue += amt;

          return {
            'Order ID': d.order.orderId,
            'Student Name': d.person.name,
            'Student Email': d.person.email,
            'Plan Name': d.plan.name,
            'Amount (₹)': d.order.amount,
            'Status': d.order.status,
            'Date': d.order.createdAt.toLocaleDateString(),
          };
        });

        return {
          reportType: 'Day Scholar Membership Revenue Report',
          generatedAt: now,
          totalRecords: rows.length,
          columns: ['Order ID', 'Student Name', 'Student Email', 'Plan Name', 'Amount (₹)', 'Status', 'Date'],
          rows,
          summary: { 'Total Collected Revenue': `₹${totalRevenue}` },
        };
      }

      case 'violations': {
        const data = await db
          .select({
            violation: violations,
            student: students,
            person: people,
          })
          .from(violations)
          .innerJoin(students, eq(violations.studentId, students.id))
          .innerJoin(people, eq(students.personId, people.id))
          .orderBy(desc(violations.createdAt))
          .limit(100);

        const rows = data.map((d) => ({
          'Violation ID': d.violation.id.slice(0, 8),
          'Student Name': d.person.name,
          'Roll Number': d.student.rollNumber,
          'Department': d.student.department,
          'Type': d.violation.violationType,
          'Description': d.violation.description || 'N/A',
          'Date': d.violation.createdAt.toLocaleDateString(),
        }));

        return {
          reportType: 'Disciplinary Violations & Penalties Report',
          generatedAt: now,
          totalRecords: rows.length,
          columns: ['Violation ID', 'Student Name', 'Roll Number', 'Department', 'Type', 'Description', 'Date'],
          rows,
        };
      }

      case 'payroll': {
        const data = await db
          .select({
            shift: workShifts,
            trainer: trainerProfiles,
            person: people,
          })
          .from(workShifts)
          .innerJoin(trainerProfiles, eq(workShifts.trainerId, trainerProfiles.id))
          .innerJoin(people, eq(trainerProfiles.personId, people.id))
          .orderBy(desc(workShifts.clockIn))
          .limit(100);

        let totalStipend = 0;
        const rows = data.map((d) => {
          const stp = d.shift.calculatedStipend ? parseFloat(d.shift.calculatedStipend) : 0;
          totalStipend += stp;

          return {
            'Shift ID': d.shift.id.slice(0, 8),
            'Trainer Name': d.person.name,
            'Hourly Rate': `₹${d.trainer.hourlyRate}/hr`,
            'Clock In': new Date(d.shift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            'Clock Out': d.shift.clockOut ? new Date(d.shift.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing',
            'Duration (Min)': d.shift.durationMinutes || '0',
            'Calculated Stipend': `₹${stp}`,
            'Date': new Date(d.shift.clockIn).toLocaleDateString(),
          };
        });

        return {
          reportType: 'Student-Trainer Payroll & Stipend Ledger',
          generatedAt: now,
          totalRecords: rows.length,
          columns: ['Shift ID', 'Trainer Name', 'Hourly Rate', 'Date', 'Clock In', 'Clock Out', 'Duration (Min)', 'Calculated Stipend'],
          rows,
          summary: { 'Total Disbursed Stipend': `₹${totalStipend}` },
        };
      }

      case 'access_logs':
      default: {
        const data = await db
          .select()
          .from(entryExitLogs)
          .orderBy(desc(entryExitLogs.createdAt))
          .limit(100);

        const rows = data.map((d) => ({
          'Log ID': d.id.slice(0, 8),
          'Device ID': d.deviceId,
          'Event Type': d.eventType,
          'Result': d.result,
          'Denial Reason': d.denialReason || 'None',
          'Timestamp': d.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          'Date': d.createdAt.toLocaleDateString(),
        }));

        return {
          reportType: 'Turnstile Hardware Access & Telemetry Logs',
          generatedAt: now,
          totalRecords: rows.length,
          columns: ['Log ID', 'Device ID', 'Event Type', 'Result', 'Denial Reason', 'Date', 'Timestamp'],
          rows,
        };
      }
    }
  }

  /**
   * Convert JSON tabular report to CSV stream string (SRS REP-012)
   */
  public exportToCsv(report: GenericReportResultDto): string {
    if (report.rows.length === 0) {
      return report.columns.join(',') + '\n';
    }

    const header = report.columns.join(',');
    const lines = report.rows.map((row) =>
      report.columns
        .map((col) => {
          const val = row[col] !== undefined ? String(row[col]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    return [header, ...lines].join('\n');
  }
}

export const reportsService = new ReportsService();
