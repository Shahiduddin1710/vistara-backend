
import { getStore } from '../stores';
import { ApiError } from '../utils/ApiError';
import {
  Clearance,
  ClearanceStatus,
  ClearanceSubjectType,
  EMPLOYEE_CLEARANCE_ITEMS,
  VISITOR_CLEARANCE_ITEMS,
} from '../models/types';

async function assertSubjectExists(
  subjectType: ClearanceSubjectType,
  subjectId: string,
): Promise<void> {
  const store = getStore();
  if (subjectType === 'VISITOR') {
    const visitor = await store.findVisitorById(subjectId);
    if (!visitor) throw ApiError.notFound('VISITOR_NOT_FOUND', 'Visitor record not found.');
  } else {
    const employee = await store.findEmployeeById(subjectId);
    if (!employee) throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee record not found.');
  }
}

function defaultsFor(subjectType: ClearanceSubjectType) {
  const source = subjectType === 'VISITOR' ? VISITOR_CLEARANCE_ITEMS : EMPLOYEE_CLEARANCE_ITEMS;
  return source.map((item) => ({
    key: item.key,
    label: item.label,
    required: item.required,
    status: 'PENDING' as ClearanceStatus,
    remarks: null,
    updatedBy: null,
    updatedAt: null,
  }));
}

/** Returns the clearance for a subject, creating it on first read. */
export async function getClearance(
  subjectType: ClearanceSubjectType,
  subjectId: string,
): Promise<Clearance> {
  const store = getStore();
  const existing = await store.findClearance(subjectType, subjectId);
  if (existing) return existing;

  await assertSubjectExists(subjectType, subjectId);
  return store.createClearance(
    { subjectType, subjectId, overall: 'PENDING', updatedBy: null },
    defaultsFor(subjectType),
  );
}

/** Non-throwing variant used when a subject may not exist yet. */
export async function findClearance(
  subjectType: ClearanceSubjectType,
  subjectId: string,
): Promise<Clearance | null> {
  return getStore().findClearance(subjectType, subjectId);
}

/** Updates one checklist row and re-derives the overall status. */
export async function updateItem(input: {
  subjectType: ClearanceSubjectType;
  subjectId: string;
  itemId: string;
  status: ClearanceStatus;
  remarks?: string | null;
  updatedBy: string;
}): Promise<Clearance> {
  const store = getStore();
  await assertSubjectExists(input.subjectType, input.subjectId);
  // Materialise the record first so a missing row is a 404, not a crash.
  await getClearance(input.subjectType, input.subjectId);

  return store.updateClearanceItem(input.subjectType, input.subjectId, input.itemId, {
    status: input.status,
    remarks: input.remarks,
    updatedBy: input.updatedBy,
  });
}

/** Sets the overall verdict and syncs it onto the visitor/employee record. */
export async function updateOverall(input: {
  subjectType: ClearanceSubjectType;
  subjectId: string;
  status: ClearanceStatus;
  updatedBy: string;
}): Promise<Clearance> {
  const store = getStore();
  await assertSubjectExists(input.subjectType, input.subjectId);
  await getClearance(input.subjectType, input.subjectId);

  return store.updateClearanceOverall(
    input.subjectType,
    input.subjectId,
    input.status,
    input.updatedBy,
  );
}

/**
 * The gate rule: entry requires an explicit `APPROVED` (or `NOT_REQUIRED`).
 * Used by `POST /visits/entry` so the refusal happens server-side.
 */
export function allowsEntry(clearance: Clearance | null, fallback: ClearanceStatus): boolean {
  const status = clearance?.overall ?? fallback;
  return status === 'APPROVED' || status === 'NOT_REQUIRED';
}
