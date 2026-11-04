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
} from '../models/types';

/** Staff record including the credential used to verify a login. */
export interface StaffRecord extends Staff {
  passwordHash: string;
}

/** A clearance being written (id/status fields are assigned by the store). */
export interface ClearanceDraft {
  subjectType: ClearanceSubjectType;
  subjectId: string;
  overall: ClearanceStatus;
  updatedBy: string | null;
}

export interface ClearanceItemDraft {
  key: string;
  label: string;
  required: boolean;
  status: ClearanceStatus;
  remarks?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface ClearanceRecord extends Clearance {
  items: (Clearance['items'][number])[];
}

/**
 * Persistence contract shared by the live (Prisma) and demo (in-memory)
 * implementations. Business rules live in the services layer so both stores
 * behave identically.
 */
export interface DataStore {
  readonly mode: ApiMode;

  /** Cheap connectivity probe used by `GET /api/health`. */
  ping(): Promise<boolean>;

  /* ── Staff ─────────────────────────────────────────────── */
  findStaffByStaffId(staffId: string): Promise<StaffRecord | null>;
  findStaffById(id: string): Promise<StaffRecord | null>;

  /* ── Gates ─────────────────────────────────────────────── */
  listGates(): Promise<Gate[]>;
  findGateByCode(code: string): Promise<Gate | null>;

  /* ── Visitors ──────────────────────────────────────────── */
  listVisitors(filter?: VisitorFilter): Promise<Visitor[]>;
  findVisitorById(id: string): Promise<Visitor | null>;
  findVisitorByIdentity(idType: IdType, idNumber: string): Promise<Visitor | null>;
  createVisitor(input: NewVisitorInput & { visitorCode: string }): Promise<Visitor>;
  updateVisitor(
    id: string,
    patch: Partial<Pick<Visitor, 'status' | 'clearanceStatus' | 'lastEntry' | 'notes'>>,
  ): Promise<Visitor>;

  /* ── Visits ────────────────────────────────────────────── */
  listVisits(filter?: VisitFilter): Promise<Visit[]>;
  findVisitById(id: string): Promise<Visit | null>;
  findOpenVisit(visitorId: string): Promise<Visit | null>;
  createVisit(input: {
    visitorId: string;
    visitorCode: string;
    visitorName: string;
    gateCode: string;
    entryAt: Date;
    expectedExitAt: Date | null;
    checklist: Visit['checklist'];
    notes: string | null;
  }): Promise<Visit>;
  updateVisit(
    id: string,
    patch: Partial<Pick<Visit, 'status' | 'exitAt' | 'exitGateCode' | 'notes'>>,
  ): Promise<Visit>;

  /* ── Employees ─────────────────────────────────────────── */
  searchEmployees(query: string, cardType?: CardType): Promise<Employee[]>;
  findEmployeeById(id: string): Promise<Employee | null>;
  findEmployeeByCard(cardNumber: string): Promise<Employee | null>;
  listTelemetry(employeeId: string): Promise<Telemetry[]>;
  addTelemetry(input: { employeeId: string; gate: string; type: TelemetryType }): Promise<Telemetry>;

  /* ── Clearances ────────────────────────────────────────── */
  findClearance(
    subjectType: ClearanceSubjectType,
    subjectId: string,
  ): Promise<Clearance | null>;
  createClearance(
    draft: ClearanceDraft,
    items: ClearanceItemDraft[],
  ): Promise<Clearance>;
  updateClearanceItem(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    itemId: string,
    patch: { status: ClearanceStatus; remarks?: string | null; updatedBy: string },
  ): Promise<Clearance>;
  updateClearanceOverall(
    subjectType: ClearanceSubjectType,
    subjectId: string,
    overall: ClearanceStatus,
    updatedBy: string,
  ): Promise<Clearance>;

  /* ── Counters used by the dashboard ────────────────────── */
  countVisitorsByCategory(category: VisitorCategory): Promise<number>;
  countVisitorsByStatus(status: VisitorStatus): Promise<number>;
}
