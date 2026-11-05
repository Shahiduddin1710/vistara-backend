/**
 * Shared domain types — these mirror `docs/API.md` exactly.
 * The contract document is the source of truth; keep them in step.
 */

export type ApiMode = 'live' | 'demo';

export type Role = 'ADMIN' | 'SUPERVISOR' | 'GATE_OFFICER';
export type VisitorStatus = 'REGISTERED' | 'INSIDE' | 'EXITED' | 'DENIED';
export type VisitStatus = 'INSIDE' | 'EXITED';
export type ClearanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
export type ClearanceSubjectType = 'VISITOR' | 'EMPLOYEE';
export type VisitorCategory = 'vendor' | 'client' | 'contractor' | 'vip' | 'other';
export type IdType = 'dl' | 'passport' | 'gov_id' | 'contractor_badge' | 'aadhar';
export type CardType = 'GREEN' | 'WHITE';
export type CardStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'PENDING';
export type TelemetryType = 'ENTRY' | 'EXIT';

export interface Staff {
  id: string;
  staffId: string;
  name: string;
  designation: string;
  role: Role;
  gateCode: string;
  shift: string;
  shiftStart: string;
  shiftEnd: string;
  phone: string;
  email: string;
  securityLevel: string;
  avatarUrl: string | null;
  authExpiresAt: string | null;
}

export interface Gate {
  id: string;
  code: string;
  name: string;
  lane: string;
}

export interface Visitor {
  id: string;
  visitorCode: string;
  fullName: string;
  phone: string;
  company: string;
  category: VisitorCategory;
  idType: IdType;
  idNumber: string;
  hostPerson: string;
  purpose: string;
  duration: string;
  allowedZones: string;
  photoUrl: string | null;
  status: VisitorStatus;
  clearanceStatus: ClearanceStatus;
  escortRequired: boolean;
  vehicleNo: string | null;
  notes: string | null;
  entryGateCode: string;
  createdAt: string;
  lastEntry: { gateCode: string; at: string } | null;
}

export interface ChecklistEntry {
  key: string;
  label: string;
  passed: boolean;
}

export interface Visit {
  id: string;
  visitorId: string;
  visitorCode: string;
  visitorName: string;
  gateCode: string;
  exitGateCode: string | null;
  status: VisitStatus;
  entryAt: string;
  exitAt: string | null;
  expectedExitAt: string | null;
  checklist: ChecklistEntry[];
  notes: string | null;
}

export interface ActiveVisit {
  visit: Visit;
  visitor: Visitor;
  dwellMinutes: number;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  company: string;
  photoUrl: string | null;
  cardNumber: string;
  cardType: CardType;
  cardStatus: CardStatus;
  accessClassification: string;
  validityFrom: string;
  validityTo: string;
  securityTier: string;
  shiftWindow: string;
  safetyProtocol: string;
  entryPoints: string[];
  clearanceStatus: ClearanceStatus;
}

export interface Telemetry {
  id: string;
  employeeId: string;
  gate: string;
  type: TelemetryType;
  at: string;
}

export interface ClearanceItem {
  id: string;
  key: string;
  label: string;
  required: boolean;
  status: ClearanceStatus;
  remarks: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface Clearance {
  id: string;
  subjectType: ClearanceSubjectType;
  subjectId: string;
  overall: ClearanceStatus;
  items: ClearanceItem[];
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ActivityItem {
  id: string;
  visitorName: string;
  photoUrl: string | null;
  company: string;
  purpose: string;
  time: string;
  type: 'entry' | 'exit';
  gateCode: string;
  visitorCode: string;
  hostPerson: string;
}

export interface GateWiseStat {
  code: string;
  name: string;
  inside: number;
  entries: number;
  exits: number;
}

export interface Dashboard {
  expectedToday: number;
  activeInside: number;
  totalExits: number;
  pendingClearance: number;
  awaitingEscort: number;
  capacityPercent: number;
  gateWise: GateWiseStat[];
  recentActivity: ActivityItem[];
}

export interface VisitorStats {
  totalVisits: number;
  avgDwellMinutes: number;
  compliantPercent: number;
  priorVisit: Visit | null;
}

export interface VisitorDetail {
  visitor: Visitor;
  visits: Visit[];
  clearance: Clearance;
  stats: VisitorStats;
}

export interface EmployeeDetail {
  employee: Employee;
  clearance: Clearance;
  telemetry: Telemetry[];
}

export interface VerifyResult {
  verified: boolean;
  reasons: string[];
  employee: Employee;
}

export interface LoginResponse {
  token: string;
  staff: Staff;
}

export interface DeviceStatus {
  status: string;
  label: string;
}

export interface SecurityAudit {
  verifiedAt: string;
  status: string;
}

export interface ProfileSettings {
  biometricScanner: DeviceStatus;
  badgePrinter: DeviceStatus;
  turnstileAutoRelease: boolean;
  audioAlert: string;
  securityAudit: SecurityAudit;
}

export interface HealthResponse {
  status: string;
  version: string;
  time: string;
  database: 'connected' | 'unavailable';
}

/** Payload accepted by `POST /visitors`. */
export interface NewVisitorInput {
  fullName: string;
  phone: string;
  company: string;
  category: VisitorCategory;
  idType: IdType;
  idNumber: string;
  hostPerson: string;
  purpose: string;
  duration: string;
  allowedZones: string;
  escortRequired?: boolean;
  vehicleNo?: string | null;
  notes?: string | null;
  entryGateCode: string;
  photoUrl?: string | null;
}

/** Query filters accepted by `GET /visitors`. */
export interface VisitorFilter {
  search?: string;
  status?: VisitorStatus;
  category?: VisitorCategory;
  gateCode?: string;
}

/** Query filters accepted by `GET /visits/*`. */
export interface VisitFilter {
  gateCode?: string;
  search?: string;
  limit?: number;
}

export const VISITOR_CLEARANCE_ITEMS: { key: string; label: string; required: boolean }[] = [
  { key: 'gov_id', label: 'Government ID verified against physical card', required: true },
  { key: 'nda', label: 'Electronic NDA signed on kiosk', required: true },
  { key: 'briefing', label: 'Mandatory Safety Briefing completed', required: true },
  { key: 'ppe', label: 'Hard Hat & High-Vis Vest Issued', required: true },
];

export const EMPLOYEE_CLEARANCE_ITEMS: { key: string; label: string; required: boolean }[] = [
  { key: 'induction', label: 'Safety induction completed', required: true },
  { key: 'training', label: 'Safety training / induction valid', required: true },
  { key: 'doc', label: 'Required document received', required: true },
];
