/**
 * Employee credential (Green / White card) verification.
 *
 * The verdict is decided entirely here — the client only renders it. A card
 * must be ACTIVE, in date, and carry an approved safety clearance; when it
 * passes, an ENTRY telemetry row is appended for the gate that asked.
 */
import { getStore } from '../stores';
import { ApiError } from '../utils/ApiError';
import { formatDateISO } from '../utils/time';
import {
  CardType,
  Employee,
  EmployeeDetail,
  Telemetry,
  VerifyResult,
} from '../models/types';
import { getClearance } from './clearanceService';

export async function search(q: string, cardType?: CardType): Promise<Employee[]> {
  return getStore().searchEmployees(q ?? '', cardType);
}

export async function detail(id: string): Promise<EmployeeDetail> {
  const store = getStore();
  const employee = await store.findEmployeeById(id);
  if (!employee) throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee record not found.');

  const clearance = await getClearance('EMPLOYEE', employee.id);
  const telemetry = await store.listTelemetry(employee.id);

  return { employee, clearance, telemetry };
}

export async function verify(id: string, gateCode: string): Promise<VerifyResult> {
  const store = getStore();

  const gate = await store.findGateByCode(gateCode);
  if (!gate) {
    throw new ApiError(400, 'GATE_NOT_FOUND', 'The selected gate terminal is not recognised.');
  }

  const employee = await store.findEmployeeById(id);
  if (!employee) throw ApiError.notFound('EMPLOYEE_NOT_FOUND', 'Employee record not found.');

  const reasons: string[] = [];

  // 1. Card status
  if (employee.cardStatus !== 'ACTIVE') {
    reasons.push(`Credential status is ${employee.cardStatus} — only ACTIVE cards are accepted.`);
  }

  // 2. Validity window
  const validTo = new Date(employee.validityTo);
  if (!Number.isNaN(validTo.getTime()) && validTo.getTime() < Date.now()) {
    reasons.push(`Credential expired on ${formatDateISO(employee.validityTo)}.`);
  }
  const validFrom = new Date(employee.validityFrom);
  if (!Number.isNaN(validFrom.getTime()) && validFrom.getTime() > Date.now()) {
    reasons.push(`Credential is not valid until ${formatDateISO(employee.validityFrom)}.`);
  }

  // 3. Safety clearance
  if (employee.clearanceStatus !== 'APPROVED' && employee.clearanceStatus !== 'NOT_REQUIRED') {
    reasons.push(
      `Safety clearance is ${employee.clearanceStatus} — entry is blocked until approved.`,
    );
  }

  const verified = reasons.length === 0;

  if (verified) {
    await store.addTelemetry({ employeeId: employee.id, gate: gateCode, type: 'ENTRY' });
  }

  return { verified, reasons, employee };
}

export async function telemetry(id: string): Promise<Telemetry[]> {
  return getStore().listTelemetry(id);
}
