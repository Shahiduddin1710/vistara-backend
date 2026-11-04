import { PrismaClient, Prisma } from '@prisma/client';
import {
  ApiMode,
  CardType,
  Clearance,
  ClearanceStatus,
  ClearanceSubjectType,
  Employee,
  Gate,
  IdType,
  NewVisitorInput,
  Staff,
  Telemetry,
  TelemetryType,
  Visit,
  Visitor,
  VisitorCategory,
  VisitorFilter,
  VisitFilter,
  VisitorStatus,
} from '../../models/types';
import { matchesQuery } from '../../utils/normalize';
import { ApiError } from '../../utils/ApiError';
import { ClearanceDraft, ClearanceItemDraft, DataStore, StaffRecord } from '../Store';

type Row = Record<string, unknown>;

const iso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toISOString();
};

const isoRequired = (value: Date | string | null | undefined): string =>
  iso(value) ?? new Date().toISOString();

/** Prisma emits snake/enum values as plain strings — narrow them safely. */
function asEnum<T extends string>(value: unknown, fallback: T): T {
  return typeof value === 'string' && (value as T) ? (value as T) : fallback;
}

function toStaff(row: Row): Staff {
  return {
    id: String(row.id),
    staffId: String(row.staffId),
    name: String(row.name),
    designation: String(row.designation),
    role: asEnum(row.role, 'GATE_OFFICER'),
    gateCode: String(row.gateCode),
    shift: String(row.shift),
    shiftStart: String(row.shiftStart),
    shiftEnd: String(row.shiftEnd),
    phone: String(row.phone),
    email: String(row.email),
    securityLevel: String(row.securityLevel),
    avatarUrl: iso(row.avatarUrl as string | null),
    authExpiresAt: iso(row.authExpiresAt as Date | null),
  };
}

function toVisitor(row: Row): Visitor {
  return {
    id: String(row.id),
    visitorCode: String(row.visitorCode),
    fullName: String(row.fullName),
    phone: String(row.phone),
    company: String(row.company),
    category: asEnum(row.category, 'other'),
    idType: asEnum(row.idType, 'gov_id'),
    idNumber: String(row.idNumber),
    hostPerson: String(row.hostPerson),
    purpose: String(row.purpose),
    duration: String(row.duration),
    allowedZones: String(row.allowedZones),
    photoUrl: iso(row.photoUrl as string | null),
    status: asEnum(row.status, 'REGISTERED'),
    clearanceStatus: asEnum(row.clearanceStatus, 'PENDING'),
    escortRequired: Boolean(row.escortRequired),
    vehicleNo: iso(row.vehicleNo as string | null),
    notes: iso(row.notes as string | null),
    entryGateCode: String(row.entryGateCode),
    createdAt: isoRequired(row.createdAt),
    lastEntry:
      row.lastEntryAt != null
        ? { gateCode: String(row.entryGateCode), at: isoRequired(row.lastEntryAt) }
        : null,
  };
}

function toVisit(row: Row): Visit {
  const rawChecklist = row.checklist;
  const checklist = Array.isArray(rawChecklist)
    ? (rawChecklist as Visit['checklist'])
    : [];
  return {
    id: String(row.id),
    visitorId: String(row.visitorId),
    visitorCode: String(row.visitorCode),
    visitorName: String(row.visitorName),
    gateCode: String(row.gateCode),
    exitGateCode: iso(row.exitGateCode as string | null),
    status: asEnum(row.status, 'INSIDE'),
    entryAt: isoRequired(row.entryAt),
    exitAt: iso(row.exitAt as Date | null),
    expectedExitAt: iso(row.expectedExitAt as Date | null),
    checklist,
    notes: iso(row.notes as string | null),
  };
}

function toEmployee(row: Row): Employee {
  const entryPoints = Array.isArray(row.entryPoints)
    ? (row.entryPoints as string[])
    : [];
  return {
    id: String(row.id),
    employeeId: String(row.employeeId),
    name: String(row.name),
    designation: String(row.designation),
    department: String(row.department),
    company: String(row.company),
    photoUrl: iso(row.photoUrl as string | null),
    cardNumber: String(row.cardNumber),
    cardType: asEnum(row.cardType, 'GREEN'),
    cardStatus: asEnum(row.cardStatus, 'ACTIVE'),
    accessClassification: String(row.accessClassification),
    validityFrom: isoRequired(row.validityFrom),
    validityTo: isoRequired(row.validityTo),
    securityTier: String(row.securityTier),
    shiftWindow: String(row.shiftWindow),
    safetyProtocol: String(row.safetyProtocol),
    entryPoints,
    clearanceStatus: asEnum(row.clearanceStatus, 'PENDING'),
  };
}

function toTelemetry(row: Row): Telemetry {
  return {
    id: String(row.id),
    employeeId: String(row.employeeId),
    gate: String(row.gate),
    type: asEnum(row.type, 'ENTRY'),
    at: isoRequired(row.at),
  };
}

function toClearance(row: Row): Clearance {
  const rawItems = Array.isArray(row.items) ? (row.items as Row[]) : [];
  return {
    id: String(row.id),
    subjectType: asEnum(row.subjectType, 'VISITOR'),
    subjectId: String(row.subjectId),
    overall: asEnum(row.overall, 'PENDING'),
    updatedBy: iso(row.updatedBy as string | null),
    updatedAt: iso(row.updatedAt as Date | null),
    items: rawItems.map((item) => ({
      id: String(item.id),
      key: String(item.key),
      label: String(item.label),
      required: Boolean(item.required),
      status: asEnum(item.status, 'PENDING'),
      remarks: iso(item.remarks as string | null),
      updatedBy: iso(item.updatedBy as string | null),
      updatedAt: iso(item.updatedAt as Date | null),
    })),
  };
}

/** APPROVED when every required item is approved, REJECTED when any is rejected. */
export function deriveOverall(
  items: { required: boolean; status: ClearanceStatus }[],
): ClearanceStatus {
  if (items.some((i) => i.status === 'REJECTED')) return 'REJECTED';
  const required = items.filter((i) => i.required);
  if (required.length > 0 && required.every((i) => i.status === 'APPROVED')) return 'APPROVED';
  if (items.length > 0 && items.every((i) => i.status !== 'PENDING')) return 'APPROVED';
  return 'PENDING';
}

/**
 * PostgreSQL-backed implementation of the store contract. All business rules
 * live in the services layer, so this behaves identically to `MemoryStore`.
 */
export class PrismaStore implements DataStore {
  readonly mode: ApiMode = 'live';

  constructor(private readonly prisma: PrismaClient) {}

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /* ── Staff ────────────────────────────────────────────────────────────── */
  async findStaffByStaffId(staffId: string): Promise<StaffRecord | null> {
    const row = (await this.prisma.staff.findUnique({
      where: { staffId },
    })) as unknown as Row | null;
    if (!row) return null;
    return { ...toStaff(row), passwordHash: String(row.passwordHash) };
  }

  async findStaffById(id: string): Promise<StaffRecord | null> {
    const row = (await this.prisma.staff.findUnique({ where: { id } })) as unknown as Row | null;
    if (!row) return null;
    return { ...toStaff(row), passwordHash: String(row.passwordHash) };
  }

  /* ── Gates ────────────────────────────────────────────────────────────── */
  async listGates(): Promise<Gate[]> {
    const rows = (await this.prisma.gate.findMany({ orderBy: { code: 'asc' } })) as unknown as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      lane: String(r.lane),
    }));
  }

  async findGateByCode(code: string): Promise<Gate | null> {
    const row = (await this.prisma.gate.findUnique({ where: { code } })) as unknown as Row | null;
    if (!row) return null;
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      lane: String(row.lane),
    };
  }

  /* ── Visitors ─────────────────────────────────────────────────────────── */
  async listVisitors(filter: VisitorFilter = {}): Promise<Visitor[]> {
    const rows = (await this.prisma.visitor.findMany({
      orderBy: { createdAt: 'desc' },
    })) as unknown as Row[];

    return rows
      .map(toVisitor)
      .filter((v) => {
        if (filter.status && v.status !== filter.status) return false;
        if (filter.category && v.category !== filter.category) return false;
        if (filter.gateCode && v.entryGateCode !== filter.gateCode) return false;
        if (filter.search) {
          return matchesQuery(
            filter.search,
            v.fullName,
            v.visitorCode,
            v.phone,
            v.company,
            v.hostPerson,
            v.idNumber,
            v.purpose,
          );
        }
        return true;
      });
  }

  async findVisitorById(id: string): Promise<Visitor | null> {
    const row = (await this.prisma.visitor.findUnique({ where: { id } })) as unknown as Row | null;
    return row ? toVisitor(row) : null;
  }

  async findVisitorByIdentity(idType: IdType, idNumber: string): Promise<Visitor | null> {
    const rows = (await this.prisma.visitor.findMany({
      where: { idType: idType as never },
    })) as unknown as Row[];
    const needle = idNumber.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    const match = rows.find(
      (r) =>
        String(r.idNumber).replace(/[^A-Za-z0-9]/g, '').toLowerCase() === needle,
    );
    return match ? toVisitor(match) : null;
  }

  async createVisitor(input: NewVisitorInput & { visitorCode: string }): Promise<Visitor> {
    const row = (await this.prisma.visitor.create({
      data: {
        visitorCode: input.visitorCode,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        company: input.company.trim(),
        category: input.category as never,
        idType: input.idType as never,
        idNumber: input.idNumber.trim(),
        hostPerson: input.hostPerson.trim(),
        purpose: input.purpose,
        duration: input.duration,
        allowedZones: input.allowedZones,
        photoUrl: input.photoUrl ?? null,
        status: 'REGISTERED',
        clearanceStatus: 'PENDING',
        escortRequired: input.escortRequired ?? false,
        vehicleNo: input.vehicleNo ?? null,
        notes: input.notes ?? null,
        entryGateCode: input.entryGateCode,
      },
    })) as unknown as Row;
    return toVisitor(row);
  }

  async updateVisitor(
    id: string,
    patch: Partial<Pick<Visitor, 'status' | 'clearanceStatus' | 'lastEntry' | 'notes'>>,
  ): Promise<Visitor> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.clearanceStatus !== undefined) data.clearanceStatus = patch.clearanceStatus;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.lastEntry !== undefined) data.lastEntryAt = patch.lastEntry ? new Date(patch.lastEntry.at) : null;

    const row = (await this.prisma.visitor.update({ where: { id }, data: data as never })) as unknown as Row;
    return toVisitor(row);
  }

  /* ── Visits ───────────────────────────────────────────────────────────── */
  async listVisits(filter: VisitFilter = {}): Promise<Visit[]> {
    const rows = (await this.prisma.visit.findMany({
      orderBy: { entryAt: 'desc' },
    })) as unknown as Row[];

    let visits = rows.map(toVisit);
    if (filter.gateCode) {
      visits = visits.filter(
        (v) => v.gateCode === filter.gateCode || v.exitGateCode === filter.gateCode,
      );
    }
    if (filter.search) {
      visits = visits.filter((v) =>
        matchesQuery(filter.search as string, v.visitorName, v.visitorCode, v.gateCode),
      );
    }
    if (filter.limit && filter.limit > 0) visits = visits.slice(0, filter.limit);
    return visits;
  }

  async findVisitById(id: string): Promise<Visit | null> {
    const row = (await this.prisma.visit.findUnique({ where: { id } })) as unknown as Row | null;
    return row ? toVisit(row) : null;
  }

  async findOpenVisit(visitorId: string): Promise<Visit | null> {
    const row = (await this.prisma.visit.findFirst({
      where: { visitorId, status: 'INSIDE' },
      orderBy: { entryAt: 'desc' },
    })) as unknown as Row | null;
    return row ? toVisit(row) : null;
  }

  async createVisit(input: {
    visitorId: string;
    visitorCode: string;
    visitorName: string;
    gateCode: string;
    entryAt: Date;
    expectedExitAt: Date | null;
    checklist: Visit['checklist'];
    notes: string | null;
  }): Promise<Visit> {
    const row = (await this.prisma.visit.create({
      data: {
        visitorId: input.visitorId,
        visitorCode: input.visitorCode,
        visitorName: input.visitorName,
        gateCode: input.gateCode,
        status: 'INSIDE',
        entryAt: input.entryAt,
        expectedExitAt: input.expectedExitAt,
        checklist: (input.checklist ?? []) as unknown as Prisma.InputJsonValue,
        notes: input.notes,
      },
    })) as unknown as Row;
    return toVisit(row);
  }

  async updateVisit(
    id: string,
    patch: Partial<Pick<Visit, 'status' | 'exitAt' | 'exitGateCode' | 'notes'>>,
  ): Promise<Visit> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.exitAt !== undefined) data.exitAt = patch.exitAt ? new Date(patch.exitAt) : null;
    if (patch.exitGateCode !== undefined) data.exitGateCode = patch.exitGateCode;
    if (patch.notes !== undefined) data.notes = patch.notes;

    const row = (await this.prisma.visit.update({ where: { id }, data: data as never })) as unknown as Row;
    return toVisit(row);
  }

  /* ── Employees ────────────────────────────────────────────────────────── */
  async searchEmployees(query: string, cardType?: CardType): Promise<Employee[]> {
    const rows = (await this.prisma.employee.findMany()) as unknown as Row[];
    return rows
      .map(toEmployee)
      .filter((e) => {
        if (cardType && e.cardType !== cardType) return false;
        if (!query) return true;
        return matchesQuery(
          query,
          e.name,
          e.employeeId,
          e.cardNumber,
          e.department,
          e.designation,
          e.company,
        );
      });
  }

  async findEmployeeById(id: string): Promise<Employee | null> {
    const row = (await this.prisma.employee.findUnique({ where: { id } })) as unknown as Row | null;
    return row ? toEmployee(row) : null;
  }

  async findEmployeeByCard(cardNumber: string): Promise<Employee | null> {
    const row = (await this.prisma.employee.findUnique({ where: { cardNumber } })) as unknown as Row | null;
    if (row) return toEmployee(row);
    // Fall back to a normalised scan so `EMP-77402` / `emp 77402` both resolve.
    const rows = (await this.prisma.employee.findMany()) as unknown as Row[];
    const needle = cardNumber.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    const match = rows.find(
      (r) =>
        String(r.cardNumber).replace(/[^A-Za-z0-9]/g, '').toLowerCase() === needle ||
        String(r.employeeId).replace(/[^A-Za-z0-9]/g, '').toLowerCase() === needle,
    );
    return match ? toEmployee(match) : null;
  }

  async listTelemetry(employeeId: string): Promise<Telemetry[]> {
    const rows = (await this.prisma.telemetry.findMany({
      where: { employeeId },
      orderBy: { at: 'desc' },
    })) as unknown as Row[];
    return rows.map(toTelemetry);
  }

  async addTelemetry(input: {
    employeeId: string;
    gate: string;
    type: TelemetryType;
  }): Promise<Telemetry> {
    const row = (await this.prisma.telemetry.create({
      data: {
        employeeId: input.employeeId,
        gate: input.gate,
        type: input.type as never,
      },
    })) as unknown as Row;
    return toTelemetry(row);
  }

  /* ── Clearances ───────────────────────────────────────────────────────── */
  async findClearance(
    subjectType: ClearanceSubjectType,
    subjectId: string,
  ): Promise<Clearance | null> {
    const row = (await this.prisma.clearance.findUnique({
      where: { subjectType_subjectId: { subjectType: subjectType as never, subjectId } },
      include: { items: { orderBy: { key: 'asc' } } },
    })) as unknown as Row | null;
    return row ? toClearance(row) : null;
  }

  async createClearance(draft: ClearanceDraft, items: ClearanceItemDraft[]): Promise<Clearance> {
    const row = (await this.prisma.clearance.create({
      data: {
        subjectType: draft.subjectType as never,
        subjectId: draft.subjectId,
        overall: draft.overall as never,
        updatedBy: draft.updatedBy,
        items: {
          create: items.map((item) => ({
            key: item.key,
            label: item.label,
            required: item.required,
            status: item.status as never,
            remarks: item.remarks ?? null,
            updatedBy: item.updatedBy ?? null,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
          })),
        },
      },
      include: { items: { orderBy: { key: 'asc' } } },
    })) as unknown as Row;
    return toClearance(row);
  }

  async updateClearanceItem(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    itemId: string,
    patch: { status: ClearanceStatus; remarks?: string | null; updatedBy: string },
  ): Promise<Clearance> {
    const existing = await this.findClearance(subjectType, subjectId);
    if (!existing) {
      throw ApiError.notFound('CLEARANCE_NOT_FOUND', 'No clearance record exists for this subject.');
    }

    await this.prisma.clearanceItem.update({
      where: { id: itemId },
      data: {
        status: patch.status as never,
        ...(patch.remarks !== undefined ? { remarks: patch.remarks } : {}),
        updatedBy: patch.updatedBy,
        updatedAt: new Date(),
      },
    });

    const refreshed = await this.findClearance(subjectType, subjectId);
    if (!refreshed) {
      throw ApiError.notFound('CLEARANCE_NOT_FOUND', 'No clearance record exists for this subject.');
    }

    const overall = deriveOverall(refreshed.items);
    await this.prisma.clearance.update({
      where: { id: refreshed.id },
      data: { overall: overall as never, updatedBy: patch.updatedBy, updatedAt: new Date() },
    });
    await this.syncSubjectStatus(subjectType, subjectId, overall);

    const final = await this.findClearance(subjectType, subjectId);
    return final ?? refreshed;
  }

  async updateClearanceOverall(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    overall: ClearanceStatus,
    updatedBy: string,
  ): Promise<Clearance> {
    const existing = await this.findClearance(subjectType, subjectId);
    if (!existing) {
      throw ApiError.notFound('CLEARANCE_NOT_FOUND', 'No clearance record exists for this subject.');
    }

    await this.prisma.clearance.update({
      where: { id: existing.id },
      data: { overall: overall as never, updatedBy, updatedAt: new Date() },
    });
    await this.syncSubjectStatus(subjectType, subjectId, overall);

    const final = await this.findClearance(subjectType, subjectId);
    return final ?? existing;
  }

  /* ── Dashboard counters ───────────────────────────────────────────────── */
  async countVisitorsByCategory(category: VisitorCategory): Promise<number> {
    return this.prisma.visitor.count({ where: { category: category as never } });
  }

  async countVisitorsByStatus(status: VisitorStatus): Promise<number> {
    return this.prisma.visitor.count({ where: { status: status as never } });
  }

  /* ── Internals ────────────────────────────────────────────────────────── */
  private async syncSubjectStatus(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    overall: ClearanceStatus,
  ): Promise<void> {
    if (subjectType === 'VISITOR') {
      await this.prisma.visitor.update({
        where: { id: subjectId },
        data: { clearanceStatus: overall as never },
      });
    } else {
      await this.prisma.employee.update({
        where: { id: subjectId },
        data: { clearanceStatus: overall as never },
      });
    }
  }
}
