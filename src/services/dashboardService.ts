/**
 * Dashboard aggregation.
 *
 * Everything is computed from the store on every request — there are no
 * cached or hard-coded figures. `gateCode` narrows only `recentActivity`;
 * `gateWise` always reports both terminals so the officer can compare them.
 */
import { getStore } from '../stores';
import { Dashboard, ActivityItem, GateWiseStat } from '../models/types';
import { isToday } from '../utils/time';

/** Site occupancy ceiling used for the capacity gauge. */
const SITE_CAPACITY = 150;

export async function get(gateCode?: string): Promise<Dashboard> {
  const store = getStore();

  const [visitors, visits, gates] = await Promise.all([
    store.listVisitors(),
    store.listVisits(),
    store.listGates(),
  ]);

  const todaysVisits = visits.filter((v) => isToday(v.entryAt) || isToday(v.exitAt));
  const open = visits.filter((v) => v.status === 'INSIDE');
  const exitedToday = todaysVisits.filter((v) => v.status === 'EXITED' && v.exitAt && isToday(v.exitAt));

  const expectedToday =
    visitors.filter((v) => isToday(v.createdAt)).length + open.length;

  const pendingClearance = visitors.filter((v) => v.clearanceStatus === 'PENDING').length;
  const awaitingEscort = open.filter((visit) => {
    const owner = visitors.find((v) => v.id === visit.visitorId);
    return Boolean(owner?.escortRequired);
  }).length;

  const capacityPercent = Math.min(
    100,
    Math.round((open.length / SITE_CAPACITY) * 100),
  );

  const gateWise: GateWiseStat[] = gates.map((gate) => {
    const entriesAtGate = todaysVisits.filter(
      (v) => v.gateCode === gate.code && isToday(v.entryAt),
    );
    const exitsAtGate = todaysVisits.filter(
      (v) => v.exitGateCode === gate.code && v.exitAt && isToday(v.exitAt),
    );
    return {
      code: gate.code,
      name: gate.name,
      inside: open.filter((v) => v.gateCode === gate.code).length,
      entries: entriesAtGate.length,
      exits: exitsAtGate.length,
    };
  });

  const recentActivity = buildActivity(visitors, todaysVisits, gateCode);

  return {
    expectedToday,
    activeInside: open.length,
    totalExits: exitedToday.length,
    pendingClearance,
    awaitingEscort,
    capacityPercent,
    gateWise,
    recentActivity,
  };
}

/** Interleaves today's entries and exits into a single newest-first strip. */
function buildActivity(
  visitors: { id: string; visitorCode: string; fullName: string; photoUrl: string | null; company: string; purpose: string; hostPerson: string }[],
  visits: { id: string; visitorId: string; visitorCode: string; gateCode: string; exitGateCode: string | null; entryAt: string; exitAt: string | null }[],
  gateCode?: string,
): ActivityItem[] {
  const byId = new Map(visitors.map((v) => [v.id, v]));
  const rows: ActivityItem[] = [];

  for (const visit of visits) {
    const owner = byId.get(visit.visitorId);
    if (!owner) continue;

    if (isToday(visit.entryAt)) {
      if (!gateCode || visit.gateCode === gateCode) {
        rows.push({
          id: `${visit.id}:entry`,
          visitorName: owner.fullName,
          photoUrl: owner.photoUrl,
          company: owner.company,
          purpose: owner.purpose,
          time: visit.entryAt,
          type: 'entry',
          gateCode: visit.gateCode,
          visitorCode: owner.visitorCode,
          hostPerson: owner.hostPerson,
        });
      }
    }

    if (visit.exitAt && isToday(visit.exitAt)) {
      const exitGate = visit.exitGateCode ?? visit.gateCode;
      if (!gateCode || exitGate === gateCode) {
        rows.push({
          id: `${visit.id}:exit`,
          visitorName: owner.fullName,
          photoUrl: owner.photoUrl,
          company: owner.company,
          purpose: owner.purpose,
          time: visit.exitAt,
          type: 'exit',
          gateCode: exitGate,
          visitorCode: owner.visitorCode,
          hostPerson: owner.hostPerson,
        });
      }
    }
  }

  return rows.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 12);
}
