/**
 * Seeds PostgreSQL with the same realistic dataset the demo store uses.
 *
 * The seed records live in `src/stores/memory/seedData.ts` so live and demo
 * modes can never drift apart: the API behaves identically either way, only
 * the persistence differs. Run with `npm run db:seed`.
 *
 * The script is idempotent — it wipes the eight tables in child → parent order
 * first, so re-seeding after a schema change is a single command.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import {
  EMPLOYEES,
  GATES,
  seedClearances,
  seedStaffRecords,
  seedTelemetry,
  seedVisitors,
  seedVisits,
} from '../src/stores/memory/seedData';

const prisma = new PrismaClient();

/** ISO string or null → `Date` or null, for Prisma's `DateTime` columns. */
function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mustDate(value: string | null | undefined, label: string): Date {
  const d = toDate(value);
  if (!d) throw new Error(`Seed produced an invalid date for ${label}: ${String(value)}`);
  return d;
}

async function wipe(): Promise<void> {
  // Child → parent so foreign keys never complain.
  await prisma.clearanceItem.deleteMany();
  await prisma.clearance.deleteMany();
  await prisma.telemetry.deleteMany();
  await prisma.visit.deleteMany(); // cascades nothing upward (visitor is parent)
  await prisma.visitor.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.gate.deleteMany();
  await prisma.staff.deleteMany();
}

async function seedGates(): Promise<void> {
  await prisma.gate.createMany({
    data: GATES.map((g) => ({ id: g.id, code: g.code, name: g.name, lane: g.lane })),
  });
}

async function seedStaff(): Promise<void> {
  await prisma.staff.createMany({
    data: seedStaffRecords().map((s) => ({
      id: s.id,
      staffId: s.staffId,
      name: s.name,
      designation: s.designation,
      role: s.role,
      passwordHash: s.passwordHash,
      gateCode: s.gateCode,
      shift: s.shift,
      shiftStart: s.shiftStart,
      shiftEnd: s.shiftEnd,
      phone: s.phone,
      email: s.email,
      securityLevel: s.securityLevel,
      avatarUrl: s.avatarUrl,
      authExpiresAt: toDate(s.authExpiresAt),
    })),
  });
}

async function seedEmployees(): Promise<void> {
  await prisma.employee.createMany({
    data: EMPLOYEES.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      name: e.name,
      designation: e.designation,
      department: e.department,
      company: e.company,
      photoUrl: e.photoUrl,
      cardNumber: e.cardNumber,
      cardType: e.cardType,
      cardStatus: e.cardStatus,
      accessClassification: e.accessClassification,
      validityFrom: mustDate(e.validityFrom, `employee ${e.employeeId} validityFrom`),
      validityTo: mustDate(e.validityTo, `employee ${e.employeeId} validityTo`),
      securityTier: e.securityTier,
      shiftWindow: e.shiftWindow,
      safetyProtocol: e.safetyProtocol,
      entryPoints: e.entryPoints,
      clearanceStatus: e.clearanceStatus,
    })),
  });
}

async function seedVisitorsIntoDb() {
  const visitors = seedVisitors();
  await prisma.visitor.createMany({
    data: visitors.map((v) => ({
      id: v.id,
      visitorCode: v.visitorCode,
      fullName: v.fullName,
      phone: v.phone,
      company: v.company,
      category: v.category,
      idType: v.idType,
      idNumber: v.idNumber,
      hostPerson: v.hostPerson,
      purpose: v.purpose,
      duration: v.duration,
      allowedZones: v.allowedZones,
      photoUrl: v.photoUrl,
      status: v.status,
      clearanceStatus: v.clearanceStatus,
      escortRequired: v.escortRequired,
      vehicleNo: v.vehicleNo,
      notes: v.notes,
      entryGateCode: v.entryGateCode,
      createdAt: mustDate(v.createdAt, `visitor ${v.visitorCode} createdAt`),
      lastEntryAt: toDate(v.lastEntry?.at ?? null),
    })),
  });
  return visitors;
}

async function seedVisitsIntoDb(
  visitors: Awaited<ReturnType<typeof seedVisitors>>,
): Promise<void> {
  const visits = seedVisits(visitors);
  await prisma.visit.createMany({
    data: visits.map((v) => ({
      id: v.id,
      visitorId: v.visitorId,
      visitorCode: v.visitorCode,
      visitorName: v.visitorName,
      gateCode: v.gateCode,
      exitGateCode: v.exitGateCode,
      status: v.status,
      entryAt: mustDate(v.entryAt, `visit ${v.id} entryAt`),
      exitAt: toDate(v.exitAt),
      expectedExitAt: toDate(v.expectedExitAt),
      checklist: v.checklist as unknown as Prisma.InputJsonValue,
      notes: v.notes,
    })),
  });
}

async function seedClearancesIntoDb(): Promise<void> {
  for (const clearance of seedClearances()) {
    await prisma.clearance.create({
      data: {
        id: clearance.id,
        subjectType: clearance.subjectType,
        subjectId: clearance.subjectId,
        overall: clearance.overall,
        updatedBy: clearance.updatedBy,
        items: {
          create: clearance.items.map((item) => ({
            key: item.key,
            label: item.label,
            required: item.required,
            status: item.status,
            remarks: item.remarks ?? null,
            updatedBy: item.updatedBy ?? null,
            updatedAt: toDate(item.updatedAt ?? null),
          })),
        },
      },
    });
  }
}

async function seedTelemetryIntoDb(): Promise<void> {
  const rows = seedTelemetry();
  await prisma.telemetry.createMany({
    data: rows.map((t) => ({
      id: t.id,
      employeeId: t.employeeId,
      gate: t.gate,
      type: t.type,
      at: mustDate(t.at, `telemetry ${t.id} at`),
    })),
  });
}

async function main(): Promise<void> {
  const start = Date.now();
  // eslint-disable-next-line no-console
  console.log('▸ Seeding VISTARA PostgreSQL database…');

  await prisma.$connect();
  await wipe();

  await seedGates();
  await seedStaff();
  await seedEmployees();

  const visitors = await seedVisitorsIntoDb();
  await seedVisitsIntoDb(visitors);
  await seedClearancesIntoDb();
  await seedTelemetryIntoDb();

  const [visitorCount, visitCount, employeeCount, clearanceCount, telemetryCount] =
    await Promise.all([
      prisma.visitor.count(),
      prisma.visit.count(),
      prisma.employee.count(),
      prisma.clearance.count(),
      prisma.telemetry.count(),
    ]);

  // eslint-disable-next-line no-console
  console.log(
    [
      `✓ GATES      ${GATES.length}`,
      `✓ STAFF      ${seedStaffRecords().length}  (password 12345678)`,
      `✓ EMPLOYEES  ${employeeCount}`,
      `✓ VISITORS   ${visitorCount}`,
      `✓ VISITS     ${visitCount}`,
      `✓ CLEARANCES ${clearanceCount}`,
      `✓ TELEMETRY  ${telemetryCount}`,
      `Done in ${Date.now() - start}ms`,
    ].join('\n'),
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
