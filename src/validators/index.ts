/**
 * Request schemas (zod) — the single place where wire input is shaped before
 * it reaches a service. Error messages are written for the person filling in
 * the form, not for developers.
 */
import { z } from 'zod';

const staffId = z
  .string({ required_error: 'Officer ID is required' })
  .trim()
  .regex(/^SEC-\d{5}$/i, 'Officer ID must look like SEC-00000');

const gateCode = z
  .string({ required_error: 'Gate terminal is required' })
  .trim()
  .toUpperCase()
  .regex(/^GATE-\d{2}$/, 'Gate must be GATE-01 or GATE-02');

const idType = z.enum(['dl', 'passport', 'gov_id', 'contractor_badge', 'aadhar']);
const visitorCategory = z.enum(['vendor', 'client', 'contractor', 'vip', 'other']);
const clearanceStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED']);

/* ── Auth ─────────────────────────────────────────────────────────────── */

export const loginSchema = z.object({
  staffId,
  password: z.string({ required_error: 'Access code is required' }).min(6, 'Access code must be at least 6 characters'),
  gateCode,
});

/* ── Visitors ─────────────────────────────────────────────────────────── */

export const visitorQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['REGISTERED', 'INSIDE', 'EXITED', 'DENIED']).optional(),
  category: visitorCategory.optional(),
  gateCode: gateCode.optional(),
});

export const createVisitorSchema = z.object({
  fullName: z
    .string({ required_error: 'Full legal name is required' })
    .trim()
    .min(2, 'Enter the visitor’s full name')
    .max(120),
  phone: z
    .string({ required_error: 'Mobile number is required' })
    .trim()
    .regex(/^\+?[\d\s().-]{7,20}$/, 'Enter a valid mobile number'),
  company: z.string().trim().max(120).default('—'),
  category: visitorCategory.default('client'),
  idType: idType.default('gov_id'),
  idNumber: z.string({ required_error: 'ID document number is required' }).trim().min(4).max(64),
  hostPerson: z.string({ required_error: 'Host person is required' }).trim().min(2).max(120),
  purpose: z.string({ required_error: 'Select a purpose of visit' }).trim().min(2).max(80),
  duration: z.string().trim().min(1).max(80).default('2 hours'),
  allowedZones: z.string().trim().max(240).default('Reception'),
  escortRequired: z.boolean().optional(),
  vehicleNo: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  entryGateCode: gateCode,
  photoUrl: z.string().max(2_000_000).nullable().optional(),
});

export const visitorIdParamSchema = z.object({
  id: z.string().min(1, 'Visitor id is required'),
});

/* ── Visits ───────────────────────────────────────────────────────────── */

export const entrySchema = z.object({
  visitorId: z.string({ required_error: 'Visitor is required' }).min(1),
  gateCode,
  checklist: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        passed: z.boolean(),
      }),
    )
    .optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const exitSchema = z.object({
  visitId: z.string({ required_error: 'Visit is required' }).min(1),
  gateCode,
  notes: z.string().trim().max(500).nullable().optional(),
});

export const activeQuerySchema = z.object({
  gateCode: gateCode.optional(),
  search: z.string().trim().optional(),
});

export const todayQuerySchema = z.object({
  gateCode: gateCode.optional(),
});

export const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/* ── Employees ────────────────────────────────────────────────────────── */

export const employeeSearchQuerySchema = z.object({
  q: z.string().trim().optional(),
  cardType: z.enum(['GREEN', 'WHITE']).optional(),
});

export const employeeIdParamSchema = z.object({
  id: z.string().min(1, 'Employee id is required'),
});

export const verifySchema = z.object({ gateCode });

/* ── Clearances ───────────────────────────────────────────────────────── */

export const subjectParamSchema = z.object({
  subjectType: z.enum(['VISITOR', 'EMPLOYEE'], {
    errorMap: () => ({ message: 'subjectType must be VISITOR or EMPLOYEE' }),
  }),
  subjectId: z.string().min(1, 'Subject id is required'),
});

export const clearanceItemParamSchema = subjectParamSchema.extend({
  itemId: z.string().min(1, 'Item id is required'),
});

export const clearanceItemSchema = z.object({
  status: clearanceStatus,
  remarks: z.string().trim().max(300).nullable().optional(),
});

export const clearanceOverallSchema = z.object({
  status: clearanceStatus,
});

/* ── Dashboard ────────────────────────────────────────────────────────── */

export const dashboardQuerySchema = z.object({
  gateCode: gateCode.optional(),
});

/* ── Profile ──────────────────────────────────────────────────────────── */

export const nothingSchema = z.object({}).strip();
