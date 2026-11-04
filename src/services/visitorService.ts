/** Visitor registration, search and dossier assembly. */
import { getStore } from '../stores';
import { ApiError } from '../utils/ApiError';
import { minutesBetween, isToday } from '../utils/time';
import {
  NewVisitorInput,
  Visitor,
  VisitorDetail,
  VisitorFilter,
  Visit,
  VisitorStats,
} from '../models/types';
import { getClearance } from './clearanceService';

/** `#VIS-4951` — continues from the highest code already in the store. */
async function nextVisitorCode(): Promise<string> {
  const store = getStore();
  const existing = await store.listVisitors();
  const max = existing.reduce((acc, v) => {
    const n = Number(/VIS-(\d+)/.exec(v.visitorCode)?.[1] ?? 0);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 4950);
  return `#VIS-${max + 1}`;
}

export async function list(filter: VisitorFilter = {}): Promise<Visitor[]> {
  return getStore().listVisitors(filter);
}

/**
 * Registers a visitor.
 *
 * Duplicate prevention is identity-based: the same normalised `idType` +
 * `idNumber` cannot be registered twice, which is what the proposal asks for
 * (a returning contractor reuses their record rather than creating a twin).
 */
export async function create(input: NewVisitorInput): Promise<Visitor> {
  const store = getStore();

  const gate = await store.findGateByCode(input.entryGateCode);
  if (!gate) {
    throw new ApiError(400, 'GATE_NOT_FOUND', 'The selected gate terminal is not recognised.');
  }

  const existing = await store.findVisitorByIdentity(input.idType, input.idNumber);
  if (existing) {
    throw ApiError.conflict(
      'VISITOR_EXISTS',
      'A visitor with this ID document type and number is already registered.',
      { existing },
    );
  }

  const visitorCode = await nextVisitorCode();
  const visitor = await store.createVisitor({ ...input, visitorCode });
  await getClearance('VISITOR', visitor.id);
  return visitor;
}

export async function getDetail(id: string): Promise<VisitorDetail> {
  const store = getStore();
  const visitor = await store.findVisitorById(id);
  if (!visitor) throw ApiError.notFound('VISITOR_NOT_FOUND', 'Visitor record not found.');

  const visits = await listVisitsFor(visitor);
  const clearance = await getClearance('VISITOR', visitor.id);

  return {
    visitor,
    visits,
    clearance,
    stats: computeStats(visits),
  };
}

export async function history(id: string): Promise<Visit[]> {
  const store = getStore();
  const visitor = await store.findVisitorById(id);
  if (!visitor) throw ApiError.notFound('VISITOR_NOT_FOUND', 'Visitor record not found.');
  return listVisitsFor(visitor);
}

/** Every visit for one visitor — matched on the unique visitor code. */
export async function listVisitsFor(visitor: Visitor): Promise<Visit[]> {
  const visits = await getStore().listVisits({ search: visitor.visitorCode });
  return visits.filter((v) => v.visitorCode === visitor.visitorCode);
}

export function computeStats(visits: Visit[]): VisitorStats {
  const now = new Date();
  const total = visits.length;
  const completed = visits.filter((v) => v.status === 'EXITED' && v.exitAt);

  const dwells = visits.map((v) => minutesBetween(v.entryAt, v.exitAt ?? now));
  const avgDwellMinutes =
    dwells.length > 0 ? Math.round(dwells.reduce((sum, d) => sum + d, 0) / dwells.length) : 0;

  const onTime = completed.filter(
    (v) => !v.expectedExitAt || new Date(v.exitAt as string) <= new Date(v.expectedExitAt),
  ).length;
  const compliantPercent =
    completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 100;

  return {
    totalVisits: total,
    avgDwellMinutes,
    compliantPercent,
    priorVisit: completed[0] ?? null,
  };
}

/** Registrations made today — the "Expected Today" building block. */
export async function countRegisteredToday(): Promise<number> {
  const visitors = await getStore().listVisitors();
  return visitors.filter((v) => isToday(v.createdAt)).length;
}
