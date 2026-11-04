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
import { matchesQuery, normalizeIdNumber, normalizeText } from '../../utils/normalize';
import { ApiError } from '../../utils/ApiError';
import {
  ClearanceDraft,
  ClearanceItemDraft,
  ClearanceRecord,
  DataStore,
  StaffRecord,
} from '../Store';
import {
  EMPLOYEES,
  EXPECTED_TODAY_BASE,
  GATES,
  seedClearances,
  seedStaffRecords,
  seedTelemetry,
  seedVisitors,
  seedVisits,
} from './seedData';

const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Seeded in-memory implementation used when PostgreSQL is not configured or
 * cannot be reached. Business rules live in the services layer, so behaviour
 * is identical to the live store — only persistence differs.
 */
export class MemoryStore implements DataStore {
  readonly mode: ApiMode = 'demo';

  private staff: StaffRecord[];
  private gates: Gate[];
  private visitors: Visitor[];
  private visits: Visit[];
  private employees: Employee[];
  private clearances: ClearanceRecord[];
  private telemetry: Telemetry[];
  private visitorSeq: number;

  constructor() {
    this.staff = seedStaffRecords();
    this.gates = [...GATES];
    this.visitors = seedVisitors();
    this.visits = seedVisits(this.visitors);
    this.employees = EMPLOYEES.map((e) => ({ ...e, entryPoints: [...e.entryPoints] }));
    this.clearances = seedClearances();
    this.telemetry = seedTelemetry();

    // Next visitor code continues from the highest seeded one (#VIS-4950).
    this.visitorSeq = this.visitors.reduce((max, v) => {
      const n = Number(/VIS-(\d+)/.exec(v.visitorCode)?.[1] ?? 0);
      return Number.isFinite(n) && n > max ? n : max;
    }, 4950);
  }

  /* ── Connectivity ─────────────────────────────────────────────────────── */
  async ping(): Promise<boolean> {
    return true;
  }

  /* ── Staff ────────────────────────────────────────────────────────────── */
  async findStaffByStaffId(staffId: string): Promise<StaffRecord | null> {
    const needle = normalizeText(staffId);
    return this.staff.find((s) => normalizeText(s.staffId) === needle) ?? null;
  }

  async findStaffById(id: string): Promise<StaffRecord | null> {
    return this.staff.find((s) => s.id === id) ?? null;
  }

  /* ── Gates ────────────────────────────────────────────────────────────── */
  async listGates(): Promise<Gate[]> {
    return [...this.gates];
  }

  async findGateByCode(code: string): Promise<Gate | null> {
    return this.gates.find((g) => g.code === code) ?? null;
  }

  /* ── Visitors ─────────────────────────────────────────────────────────── */
  async listVisitors(filter: VisitorFilter = {}): Promise<Visitor[]> {
    return this.visitors
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
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async findVisitorById(id: string): Promise<Visitor | null> {
    return this.visitors.find((v) => v.id === id) ?? null;
  }

  async findVisitorByIdentity(idType: IdType, idNumber: string): Promise<Visitor | null> {
    const needle = normalizeIdNumber(idNumber);
    return (
      this.visitors.find(
        (v) => v.idType === idType && normalizeIdNumber(v.idNumber) === needle,
      ) ?? null
    );
  }

  async createVisitor(input: NewVisitorInput & { visitorCode: string }): Promise<Visitor> {
    this.visitorSeq += 1;
    const now = new Date().toISOString();
    const visitor: Visitor = {
      id: uid('vis'),
      visitorCode: input.visitorCode || `#VIS-${this.visitorSeq}`,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      company: input.company.trim(),
      category: input.category,
      idType: input.idType,
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
      createdAt: now,
      lastEntry: null,
    };
    this.visitors.unshift(visitor);

    // Every new visitor starts with an empty (all-PENDING) clearance checklist.
    this.clearances.push({
      id: uid('clr'),
      subjectType: 'VISITOR',
      subjectId: visitor.id,
      overall: 'PENDING',
      items: this.defaultVisitorItems(),
      updatedBy: null,
      updatedAt: null,
    });

    return visitor;
  }

  async updateVisitor(
    id: string,
    patch: Partial<Pick<Visitor, 'status' | 'clearanceStatus' | 'lastEntry' | 'notes'>>,
  ): Promise<Visitor> {
    const visitor = this.visitors.find((v) => v.id === id);
    if (!visitor) throw ApiError.notFound('VISITOR_NOT_FOUND', 'Visitor record not found.');
    Object.assign(visitor, patch);
    return visitor;
  }

  /* ── Visits ───────────────────────────────────────────────────────────── */
  async listVisits(filter: VisitFilter = {}): Promise<Visit[]> {
    let rows = [...this.visits];

    if (filter.gateCode) {
      rows = rows.filter((v) => v.gateCode === filter.gateCode || v.exitGateCode === filter.gateCode);
    }
    if (filter.search) {
      rows = rows.filter((v) =>
        matchesQuery(filter.search as string, v.visitorName, v.visitorCode, v.gateCode),
      );
    }

    rows.sort((a, b) => (a.entryAt < b.entryAt ? 1 : -1));
    if (filter.limit && filter.limit > 0) rows = rows.slice(0, filter.limit);
    return rows;
  }

  async findVisitById(id: string): Promise<Visit | null> {
    return this.visits.find((v) => v.id === id) ?? null;
  }

  async findOpenVisit(visitorId: string): Promise<Visit | null> {
    return this.visits.find((v) => v.visitorId === visitorId && v.status === 'INSIDE') ?? null;
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
    const visit: Visit = {
      id: uid('visit'),
      visitorId: input.visitorId,
      visitorCode: input.visitorCode,
      visitorName: input.visitorName,
      gateCode: input.gateCode,
      exitGateCode: null,
      status: 'INSIDE',
      entryAt: input.entryAt.toISOString(),
      exitAt: null,
      expectedExitAt: input.expectedExitAt ? input.expectedExitAt.toISOString() : null,
      checklist: input.checklist ?? [],
      notes: input.notes,
    };
    this.visits.unshift(visit);
    return visit;
  }

  async updateVisit(
    id: string,
    patch: Partial<Pick<Visit, 'status' | 'exitAt' | 'exitGateCode' | 'notes'>>,
  ): Promise<Visit> {
    const visit = this.visits.find((v) => v.id === id);
    if (!visit) throw ApiError.notFound('VISIT_NOT_FOUND', 'Visit record not found.');
    Object.assign(visit, patch);
    return visit;
  }

  /* ── Employees ────────────────────────────────────────────────────────── */
  async searchEmployees(query: string, cardType?: CardType): Promise<Employee[]> {
    return this.employees.filter((e) => {
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
    return this.employees.find((e) => e.id === id) ?? null;
  }

  async findEmployeeByCard(cardNumber: string): Promise<Employee | null> {
    const needle = normalizeIdNumber(cardNumber);
    return this.employees.find((e) => normalizeIdNumber(e.cardNumber) === needle) ?? null;
  }

  async listTelemetry(employeeId: string): Promise<Telemetry[]> {
    return this.telemetry
      .filter((t) => t.employeeId === employeeId)
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  async addTelemetry(input: {
    employeeId: string;
    gate: string;
    type: TelemetryType;
  }): Promise<Telemetry> {
    const row: Telemetry = {
      id: uid('tel'),
      employeeId: input.employeeId,
      gate: input.gate,
      type: input.type,
      at: new Date().toISOString(),
    };
    this.telemetry.unshift(row);
    return row;
  }

  /* ── Clearances ───────────────────────────────────────────────────────── */
  async findClearance(
    subjectType: ClearanceSubjectType,
    subjectId: string,
  ): Promise<Clearance | null> {
    return (
      this.clearances.find(
        (c) => c.subjectType === subjectType && c.subjectId === subjectId,
      ) ?? null
    );
  }

  async createClearance(draft: ClearanceDraft, items: ClearanceItemDraft[]): Promise<Clearance> {
    const record: Clearance = {
      id: uid('clr'),
      subjectType: draft.subjectType,
      subjectId: draft.subjectId,
      overall: draft.overall,
      updatedBy: draft.updatedBy,
      updatedAt: draft.updatedBy ? new Date().toISOString() : null,
      items: items.map((item) => ({
        id: uid('clritem'),
        key: item.key,
        label: item.label,
        required: item.required,
        status: item.status,
        remarks: item.remarks ?? null,
        updatedBy: item.updatedBy ?? null,
        updatedAt: item.updatedAt ?? null,
      })),
    };
    this.clearances.push(record);
    return record;
  }

  async updateClearanceItem(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    itemId: string,
    patch: { status: ClearanceStatus; remarks?: string | null; updatedBy: string },
  ): Promise<Clearance> {
    const record = this.findOrThrow(subjectType, subjectId);
    const item = record.items.find((i) => i.id === itemId);
    if (!item) throw ApiError.notFound('CLEARANCE_NOT_FOUND', 'Clearance item not found.');

    item.status = patch.status;
    item.remarks = patch.remarks ?? item.remarks;
    item.updatedBy = patch.updatedBy;
    item.updatedAt = new Date().toISOString();

    record.overall = deriveOverall(record.items);
    record.updatedBy = patch.updatedBy;
    record.updatedAt = new Date().toISOString();
    this.syncSubjectStatus(subjectType, subjectId, record.overall);
    return record;
  }

  async updateClearanceOverall(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    overall: ClearanceStatus,
    updatedBy: string,
  ): Promise<Clearance> {
    const record = this.findOrThrow(subjectType, subjectId);
    record.overall = overall;
    record.updatedBy = updatedBy;
    record.updatedAt = new Date().toISOString();
    this.syncSubjectStatus(subjectType, subjectId, overall);
    return record;
  }

  /* ── Dashboard counters ───────────────────────────────────────────────── */
  async countVisitorsByCategory(category: VisitorCategory): Promise<number> {
    return this.visitors.filter((v) => v.category === category).length;
  }

  async countVisitorsByStatus(status: VisitorStatus): Promise<number> {
    return this.visitors.filter((v) => v.status === status).length;
  }

  /* ── Internals ────────────────────────────────────────────────────────── */
  private findOrThrow(
    subjectType: ClearanceSubjectType,
    subjectId: string,
  ): Clearance {
    const record = this.clearances.find(
      (c) => c.subjectType === subjectType && c.subjectId === subjectId,
    );
    if (!record) {
      throw ApiError.notFound('CLEARANCE_NOT_FOUND', 'No clearance record exists for this subject.');
    }
    return record;
  }

  /** Mirrors the overall clearance status back onto the visitor/employee. */
  private syncSubjectStatus(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    overall: ClearanceStatus,
  ): void {
    if (subjectType === 'VISITOR') {
      const visitor = this.visitors.find((v) => v.id === subjectId);
      if (visitor) visitor.clearanceStatus = overall;
    } else {
      const employee = this.employees.find((e) => e.id === subjectId);
      if (employee) employee.clearanceStatus = overall;
    }
  }

  private defaultVisitorItems(): Clearance['items'] {
    const { VISITOR_CLEARANCE_ITEMS } = require('../../models/types') as typeof import('../../models/types');
    return VISITOR_CLEARANCE_ITEMS.map((item) => ({
      id: uid('clritem'),
      key: item.key,
      label: item.label,
      required: item.required,
      status: 'PENDING' as ClearanceStatus,
      remarks: null,
      updatedBy: null,
      updatedAt: null,
    }));
  }
  /** Base figure the dashboard adds live counts on top of. */
  static get expectedTodayBase(): number {
    return EXPECTED_TODAY_BASE;
  }
}

/** APPROVED when every required item is approved, REJECTED when any is rejected. */
export function deriveOverall(items: { required: boolean; status: ClearanceStatus }[]): ClearanceStatus {
  if (items.some((i) => i.status === 'REJECTED')) return 'REJECTED';
  const required = items.filter((i) => i.required);
  if (required.length > 0 && required.every((i) => i.status === 'APPROVED')) return 'APPROVED';
  if (items.length > 0 && items.every((i) => i.status !== 'PENDING')) return 'APPROVED';
  return 'PENDING';
}
