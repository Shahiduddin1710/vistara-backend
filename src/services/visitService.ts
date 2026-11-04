/**
 * Gate transactions — entry and exit.
 *
 * Every rule the proposal calls out lives here, evaluated server-side so the
 * client cannot bypass them:
 *   • a visitor already inside cannot enter twice      → VISITOR_ALREADY_INSIDE
 *   • a visitor with PENDING/REJECTED clearance cannot → CLEARANCE_NOT_APPROVED
 *   • a denied visitor cannot enter                    → VISITOR_DENIED
 *   • a visit that is not open cannot be closed twice   → VISIT_NOT_INSIDE
 */
import { getStore } from '../stores';
import { ApiError } from '../utils/ApiError';
import { matchesQuery, parseDurationHours } from '../utils/normalize';
import { isToday, minutesBetween } from '../utils/time';
import { ActiveVisit, Visit } from '../models/types';
import { getClearance, allowsEntry } from './clearanceService';

export interface EntryInput {
  visitorId: string;
  gateCode: string;
  checklist?: { key: string; label: string; passed: boolean }[];
  notes?: string | null;
}

export interface ExitInput {
  visitId: string;
  gateCode: string;
  notes?: string | null;
}

export async function recordEntry(input: EntryInput): Promise<Visit> {
  const store = getStore();

  const gate = await store.findGateByCode(input.gateCode);
  if (!gate) {
    throw new ApiError(400, 'GATE_NOT_FOUND', 'The selected gate terminal is not recognised.');
  }

  const visitor = await store.findVisitorById(input.visitorId);
  if (!visitor) throw ApiError.notFound('VISITOR_NOT_FOUND', 'Visitor record not found.');

  if (visitor.status === 'DENIED') {
    throw new ApiError(403, 'VISITOR_DENIED', 'Access for this visitor has been denied.');
  }

  const open = await store.findOpenVisit(visitor.id);
  if (open) {
    throw ApiError.conflict(
      'VISITOR_ALREADY_INSIDE',
      `${visitor.fullName} already has an open visit (entered ${open.entryAt}).`,
      { visit: open },
    );
  }

  const clearance = await getClearance('VISITOR', visitor.id);
  if (!allowsEntry(clearance, visitor.clearanceStatus)) {
    throw ApiError.unprocessable(
      'CLEARANCE_NOT_APPROVED',
      `Safety clearance is ${clearance.overall}. A supervisor must approve the checklist before entry.`,
      { clearance },
    );
  }

  const entryAt = new Date();
  const expectedExitAt = new Date(
    entryAt.getTime() + parseDurationHours(visitor.duration) * 3_600_000,
  );

  const visit = await store.createVisit({
    visitorId: visitor.id,
    visitorCode: visitor.visitorCode,
    visitorName: visitor.fullName,
    gateCode: input.gateCode,
    entryAt,
    expectedExitAt,
    checklist: input.checklist ?? [],
    notes: input.notes ?? null,
  });

  await store.updateVisitor(visitor.id, {
    status: 'INSIDE',
    lastEntry: { gateCode: input.gateCode, at: entryAt.toISOString() },
  });

  return visit;
}

export async function recordExit(input: ExitInput): Promise<Visit> {
  const store = getStore();

  const gate = await store.findGateByCode(input.gateCode);
  if (!gate) {
    throw new ApiError(400, 'GATE_NOT_FOUND', 'The selected gate terminal is not recognised.');
  }

  const visit = await store.findVisitById(input.visitId);
  if (!visit) throw ApiError.notFound('VISIT_NOT_FOUND', 'Visit record not found.');

  if (visit.status !== 'INSIDE') {
    throw ApiError.conflict(
      'VISIT_NOT_INSIDE',
      'This visit has already been closed — a visitor cannot exit twice.',
      { visit },
    );
  }

  const exitAt = new Date();
  const closed = await store.updateVisit(visit.id, {
    status: 'EXITED',
    exitAt: exitAt.toISOString(),
    exitGateCode: input.gateCode,
    notes: input.notes ?? visit.notes,
  });

  const visitor = await store.findVisitorById(visit.visitorId);
  if (visitor) {
    const stillInside = await store.findOpenVisit(visitor.id);
    if (!stillInside) {
      await store.updateVisitor(visitor.id, { status: 'EXITED' });
    }
  }

  return closed;
}

/** Everyone with an open visit, newest entry first, with a live dwell time. */
export async function active(params: {
  gateCode?: string;
  search?: string;
} = {}): Promise<ActiveVisit[]> {
  const store = getStore();
  const visits = await store.listVisits(
    params.gateCode ? { gateCode: params.gateCode } : {},
  );

  const open = visits.filter((v) => v.status === 'INSIDE');
  const rows: ActiveVisit[] = [];

  for (const visit of open) {
    const visitor = await store.findVisitorById(visit.visitorId);
    if (!visitor) continue;
    rows.push({ visit, visitor, dwellMinutes: minutesBetween(visit.entryAt) });
  }

  const filtered = params.search
    ? rows.filter((row) =>
        matchesQuery(
          params.search as string,
          row.visitor.fullName,
          row.visitor.visitorCode,
          row.visitor.company,
          row.visit.gateCode,
        ),
      )
    : rows;

  return filtered;
}

/** Transactions that touch today, newest entry first. */
export async function today(gateCode?: string): Promise<Visit[]> {
  const visits = await getStore().listVisits(gateCode ? { gateCode } : {});
  return visits.filter(
    (v) => isToday(v.entryAt) || isToday(v.exitAt) || v.status === 'INSIDE',
  );
}

/** Most recent transactions, for the dashboard's live activity strip. */
export async function recent(limit = 10): Promise<Visit[]> {
  return getStore().listVisits({ limit });
}
