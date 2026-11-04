import bcrypt from 'bcryptjs';
import {
  EMPLOYEE_CLEARANCE_ITEMS,
  VISITOR_CLEARANCE_ITEMS,
  Employee,
  Gate,
  Staff,
  Telemetry,
  Visit,
  Visitor,
} from '../../models/types';
import { ClearanceItemDraft, ClearanceRecord, StaffRecord } from '../Store';

/* ── Deterministic pseudo-random generator so seed data is stable ─────────── */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const rng = makeRng(0x56535452);

const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const between = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Minutes since midnight for a clock time like "08:42". */
function atMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Start of today in local time. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateAtOffset(days: number, hhmm: string): Date {
  const base = startOfToday();
  base.setDate(base.getDate() + days);
  base.setMinutes(atMinutes(hhmm), 0, 0);
  return base;
}

/* ── Gates ───────────────────────────────────────────────────────────────── */
export const GATES: Gate[] = [
  { id: 'gate-01', code: 'GATE-01', name: 'Gate 01 (Executive Headquarters Main)', lane: 'Lane 01' },
  { id: 'gate-02', code: 'GATE-02', name: 'Gate 02 (Contractor & Vendor Screening)', lane: 'Lane 02' },
];

/* ── Staff (password for all three is `12345678`) ───────────────────────── */
export const STAFF_PASSWORD = '12345678';

export interface SeedStaff extends Staff {
  password: string;
}

export const STAFF: SeedStaff[] = [
  {
    id: 'staff-rajesh',
    staffId: 'SEC-89241',
    name: 'Rajesh Patil',
    designation: 'Senior Security Operations Officer',
    role: 'SUPERVISOR',
    gateCode: 'GATE-01',
    shift: 'Shift A',
    shiftStart: '06:00',
    shiftEnd: '14:00',
    phone: '+91 98765 40121',
    email: 'rajesh.patil@vistara.example',
    securityLevel: 'Level 4 (Supervisor)',
    avatarUrl: null,
    authExpiresAt: null,
    password: STAFF_PASSWORD,
  },
  {
    id: 'staff-amit',
    staffId: 'SEC-89107',
    name: 'Amit Sen',
    designation: 'Gate Security Officer',
    role: 'GATE_OFFICER',
    gateCode: 'GATE-01',
    shift: 'Shift A',
    shiftStart: '06:00',
    shiftEnd: '14:00',
    phone: '+91 98765 40288',
    email: 'amit.sen@vistara.example',
    securityLevel: 'Level 2 (Officer)',
    avatarUrl: null,
    authExpiresAt: null,
    password: STAFF_PASSWORD,
  },
  {
    id: 'staff-kavita',
    staffId: 'SEC-89003',
    name: 'Kavita Pillai',
    designation: 'Security Administrator',
    role: 'ADMIN',
    gateCode: 'GATE-02',
    shift: 'Shift B',
    shiftStart: '14:00',
    shiftEnd: '22:00',
    phone: '+91 98765 40907',
    email: 'kavita.pillai@vistara.example',
    securityLevel: 'Level 5 (Administrator)',
    avatarUrl: null,
    authExpiresAt: null,
    password: STAFF_PASSWORD,
  },
];

/** Lazily hashed so the seed stays synchronous-ish and bcrypt runs once. */
let cachedHash: string | null = null;
export function staffPasswordHash(): string {
  if (!cachedHash) cachedHash = bcrypt.hashSync(STAFF_PASSWORD, 10);
  return cachedHash;
}

export function seedStaffRecords(): StaffRecord[] {
  const hash = staffPasswordHash();
  return STAFF.map((s) => {
    const { password: _pw, ...rest } = s;
    return { ...rest, passwordHash: hash };
  });
}

/* ── Employees (Green / White card holders) ─────────────────────────────── */
export const EMPLOYEES: Employee[] = [
  {
    id: 'emp-arjun',
    employeeId: 'EMP-77402',
    name: 'Arjun Mehta',
    designation: 'Lead Plant Metallurgist',
    department: 'Heavy Metallurgy Unit',
    company: 'Vistara Industrial',
    photoUrl: null,
    cardNumber: 'EMP-77402',
    cardType: 'GREEN',
    cardStatus: 'ACTIVE',
    accessClassification: 'GREEN CARD • FULL',
    validityFrom: '2025-01-01',
    validityTo: '2026-12-31',
    securityTier: 'Tier 3 (Hazardous)',
    shiftWindow: 'Shift A & B (06:00 – 22:00)',
    safetyProtocol: 'Boots, Eye Shields, Dosimeter Active',
    entryPoints: ['Gate 01', 'Gate 02'],
    clearanceStatus: 'APPROVED',
  },
  {
    id: 'emp-riya',
    employeeId: 'EMP-81145',
    name: 'Riya Kulkarni',
    designation: 'Contractor — Civil Works',
    department: 'Facility Maintenance',
    company: 'Shakti Construction LLP',
    photoUrl: null,
    cardNumber: 'WC-41188',
    cardType: 'WHITE',
    cardStatus: 'ACTIVE',
    accessClassification: 'WHITE CARD • CONTRACTOR',
    validityFrom: '2025-09-01',
    validityTo: '2027-03-31',
    securityTier: 'Tier 1 (Escorted)',
    shiftWindow: 'Shift A (06:00 – 14:00)',
    safetyProtocol: 'Boots, Hard Hat, Harness for work at height',
    entryPoints: ['Gate 02'],
    clearanceStatus: 'APPROVED',
  },
  {
    id: 'emp-suresh',
    employeeId: 'EMP-65118',
    name: 'Suresh Iyer',
    designation: 'Electrical Technician',
    department: 'Utilities',
    company: 'Vistara Industrial',
    photoUrl: null,
    cardNumber: 'WC-39027',
    cardType: 'WHITE',
    cardStatus: 'EXPIRED',
    accessClassification: 'WHITE CARD • CONTRACTOR',
    validityFrom: '2024-01-01',
    validityTo: '2025-06-30',
    securityTier: 'Tier 1 (Escorted)',
    shiftWindow: 'Shift B (14:00 – 22:00)',
    safetyProtocol: 'Boots, Insulated Gloves, Arc-Flash Rating',
    entryPoints: ['Gate 02'],
    clearanceStatus: 'APPROVED',
  },
  {
    id: 'emp-nikhil',
    employeeId: 'EMP-71044',
    name: 'Nikhil Rao',
    designation: 'Quality Auditor',
    department: 'Quality Assurance',
    company: 'Vistara Industrial',
    photoUrl: null,
    cardNumber: 'EMP-71044',
    cardType: 'GREEN',
    cardStatus: 'SUSPENDED',
    accessClassification: 'GREEN CARD • FULL',
    validityFrom: '2025-02-01',
    validityTo: '2026-08-31',
    securityTier: 'Tier 2 (General)',
    shiftWindow: 'Shift A & B (06:00 – 22:00)',
    safetyProtocol: 'Boots, Eye Shields',
    entryPoints: ['Gate 01', 'Gate 02'],
    clearanceStatus: 'APPROVED',
  },
  {
    id: 'emp-deepak',
    employeeId: 'EMP-90211',
    name: 'Deepak Verma',
    designation: 'Contractor — HVAC Services',
    department: 'Facility Maintenance',
    company: 'AirFlow Systems Pvt Ltd',
    photoUrl: null,
    cardNumber: 'WC-42016',
    cardType: 'WHITE',
    cardStatus: 'PENDING',
    accessClassification: 'WHITE CARD • CONTRACTOR',
    validityFrom: '2026-01-01',
    validityTo: '2026-12-31',
    securityTier: 'Tier 1 (Escorted)',
    shiftWindow: 'Shift A (06:00 – 14:00)',
    safetyProtocol: 'Boots, Hard Hat, Confined Space Permit',
    entryPoints: ['Gate 02'],
    clearanceStatus: 'PENDING',
  },
  {
    id: 'emp-farhan',
    employeeId: 'EMP-78890',
    name: 'Farhan Qureshi',
    designation: 'Shift Supervisor',
    department: 'Assembly Line 2',
    company: 'Vistara Industrial',
    photoUrl: null,
    cardNumber: 'EMP-78890',
    cardType: 'GREEN',
    cardStatus: 'ACTIVE',
    accessClassification: 'GREEN CARD • FULL',
    validityFrom: '2025-03-15',
    validityTo: '2027-01-31',
    securityTier: 'Tier 2 (General)',
    shiftWindow: 'Shift A & B (06:00 – 22:00)',
    safetyProtocol: 'Boots, Eye Shields, Hearing Protection',
    entryPoints: ['Gate 01', 'Gate 02'],
    clearanceStatus: 'APPROVED',
  },
  {
    id: 'emp-meera',
    employeeId: 'EMP-82507',
    name: 'Meera Iyer',
    designation: 'Contractor — Catering',
    department: 'Canteen Services',
    company: 'Annapurna Caterers',
    photoUrl: null,
    cardNumber: 'WC-43310',
    cardType: 'WHITE',
    cardStatus: 'ACTIVE',
    accessClassification: 'WHITE CARD • CONTRACTOR',
    validityFrom: '2025-11-01',
    validityTo: '2026-11-30',
    securityTier: 'Tier 1 (Escorted)',
    shiftWindow: 'Shift A (05:00 – 13:00)',
    safetyProtocol: 'Apron, Hair Net, Non-slip Footwear',
    entryPoints: ['Gate 02'],
    clearanceStatus: 'APPROVED',
  },
  {
    id: 'emp-vikram',
    employeeId: 'EMP-76312',
    name: 'Vikram Malhotra',
    designation: 'Contractor — Calibration Vendor',
    department: 'Metrology Lab',
    company: 'Apex Technologies',
    photoUrl: null,
    cardNumber: 'WC-40902',
    cardType: 'WHITE',
    cardStatus: 'INACTIVE',
    accessClassification: 'WHITE CARD • CONTRACTOR',
    validityFrom: '2025-04-01',
    validityTo: '2026-04-30',
    securityTier: 'Tier 1 (Escorted)',
    shiftWindow: 'Shift A (06:00 – 14:00)',
    safetyProtocol: 'Boots, Lab Coat',
    entryPoints: ['Gate 02'],
    clearanceStatus: 'REJECTED',
  },
];

/* ── Visitors ───────────────────────────────────────────────────────────── */
interface SeedVisitorSpec {
  id: string;
  visitorCode: string;
  fullName: string;
  phone: string;
  company: string;
  category: Visitor['category'];
  idType: Visitor['idType'];
  idNumber: string;
  hostPerson: string;
  purpose: string;
  duration: string;
  allowedZones: string;
  status: Visitor['status'];
  clearanceStatus: Visitor['clearanceStatus'];
  escortRequired?: boolean;
  vehicleNo?: string | null;
  notes?: string | null;
  entryGateCode: 'GATE-01' | 'GATE-02';
  createdAtDaysAgo?: number;
}

const VISITOR_SPECS: SeedVisitorSpec[] = [
  {
    id: 'vis-david',
    visitorCode: '#VIS-4920',
    fullName: 'David Richardson',
    phone: '+1 (555) 382-9012',
    company: 'Honeywell Automation',
    category: 'vendor',
    idType: 'dl',
    idNumber: 'DL-8902-XJ',
    hostPerson: 'Priya Sharma — Lead Chemist, Lab 3',
    purpose: 'Client Meeting',
    duration: '2 Hours (until 12:30 PM)',
    allowedZones: 'Building B, Plant floor 2',
    status: 'INSIDE',
    clearanceStatus: 'APPROVED',
    entryGateCode: 'GATE-01',
    vehicleNo: 'MH-04-AZ-7712',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-marcus',
    visitorCode: '#VIS-4918',
    fullName: 'Marcus Chen',
    phone: '+1 (555) 214-7741',
    company: 'Kuka Robotics',
    category: 'vendor',
    idType: 'passport',
    idNumber: 'P-44192883',
    hostPerson: 'Tanmay Roy — Head of Automation',
    purpose: 'Maintenance',
    duration: '6 Hours (until 04:30 PM)',
    allowedZones: 'Assembly line 2, Maintenance bay 4',
    status: 'INSIDE',
    clearanceStatus: 'APPROVED',
    entryGateCode: 'GATE-01',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-elena',
    visitorCode: '#VIS-4931',
    fullName: 'Elena Rostova',
    phone: '+44 20 7946 0311',
    company: 'TÜV SÜD',
    category: 'client',
    idType: 'passport',
    idNumber: 'PA-77213390',
    hostPerson: 'Mark Vance — Compliance Officer',
    purpose: 'Audit',
    duration: '4 Hours (until 02:30 PM)',
    allowedZones: 'Building A, Archive room',
    status: 'INSIDE',
    clearanceStatus: 'APPROVED',
    escortRequired: true,
    entryGateCode: 'GATE-02',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-siddharth',
    visitorCode: '#VIS-4899',
    fullName: 'Siddharth Nair',
    phone: '+91 98110 22334',
    company: 'Schneider Electric',
    category: 'contractor',
    idType: 'gov_id',
    idNumber: 'GOI-4422-8891',
    hostPerson: 'Kavita Pillai — Security Administration',
    purpose: 'Maintenance',
    duration: '3 Hours (until 01:00 PM)',
    allowedZones: 'Electrical room, Plant floor 2',
    status: 'INSIDE',
    clearanceStatus: 'APPROVED',
    entryGateCode: 'GATE-01',
    createdAtDaysAgo: 1,
  },
  {
    id: 'vis-aisha',
    visitorCode: '#VIS-4936',
    fullName: 'Aisha Kapoor',
    phone: '+91 98200 44556',
    company: 'Northwind Logistics',
    category: 'vendor',
    idType: 'dl',
    idNumber: 'DL-7710-QQ',
    hostPerson: 'Tanmay Roy — Head of Automation',
    purpose: 'Client Meeting',
    duration: '2 Hours (until 12:00 PM)',
    allowedZones: 'Loading dock, Gate 02 reception',
    status: 'INSIDE',
    clearanceStatus: 'APPROVED',
    vehicleNo: 'MH-12-QQ-4471',
    entryGateCode: 'GATE-02',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-thomas',
    visitorCode: '#VIS-4941',
    fullName: 'Thomas Klein',
    phone: '+49 30 90128844',
    company: 'Bosch Rexroth',
    category: 'vendor',
    idType: 'passport',
    idNumber: 'PA-11928374',
    hostPerson: 'Priya Sharma — Lead Chemist, Lab 3',
    purpose: 'Maintenance',
    duration: '5 Hours (until 03:00 PM)',
    allowedZones: 'Building B, Plant floor 2',
    status: 'REGISTERED',
    clearanceStatus: 'PENDING',
    entryGateCode: 'GATE-01',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-grace',
    visitorCode: '#VIS-4944',
    fullName: 'Grace Okafor',
    phone: '+44 20 7946 0555',
    company: 'Deloitte',
    category: 'client',
    idType: 'gov_id',
    idNumber: 'GOI-9911-2277',
    hostPerson: 'Mark Vance — Compliance Officer',
    purpose: 'Audit',
    duration: '3 Hours (until 01:30 PM)',
    allowedZones: 'Building A, Finance floor 1',
    status: 'REGISTERED',
    clearanceStatus: 'PENDING',
    entryGateCode: 'GATE-01',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-rajeshk',
    visitorCode: '#VIS-4912',
    fullName: 'Rajesh Kumar',
    phone: '+91 98450 11223',
    company: 'Blue Dart Express',
    category: 'other',
    idType: 'gov_id',
    idNumber: 'GOI-3355-1188',
    hostPerson: 'Reception — Front Desk',
    purpose: 'Client Meeting',
    duration: '30 Minutes',
    allowedZones: 'Reception, Loading dock',
    status: 'EXITED',
    clearanceStatus: 'APPROVED',
    vehicleNo: 'MH-12-BD-9911',
    entryGateCode: 'GATE-01',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-sarah',
    visitorCode: '#VIS-4908',
    fullName: 'Sarah Jenkins',
    phone: '+1 (555) 901-2255',
    company: 'Whitfield Consulting',
    category: 'vip',
    idType: 'passport',
    idNumber: 'PA-55210099',
    hostPerson: 'Mark Vance — Compliance Officer',
    purpose: 'Client Meeting',
    duration: '4 Hours (until 02:00 PM)',
    allowedZones: 'Building A, Executive floor 5',
    status: 'EXITED',
    clearanceStatus: 'APPROVED',
    entryGateCode: 'GATE-02',
    createdAtDaysAgo: 1,
  },
  {
    id: 'vis-luis',
    visitorCode: '#VIS-4902',
    fullName: 'Luis Fernández',
    phone: '+34 91 220 4488',
    company: 'Apex Technologies',
    category: 'contractor',
    idType: 'dl',
    idNumber: 'DL-5520-LL',
    hostPerson: 'Kavita Pillai — Security Administration',
    purpose: 'Maintenance',
    duration: '6 Hours (until 04:00 PM)',
    allowedZones: 'Metrology lab, Building B',
    status: 'DENIED',
    clearanceStatus: 'REJECTED',
    entryGateCode: 'GATE-02',
    notes: 'Identity document could not be validated — referred to supervisor.',
    createdAtDaysAgo: 2,
  },
  {
    id: 'vis-nadia',
    visitorCode: '#VIS-4947',
    fullName: 'Nadia Haddad',
    phone: '+971 50 442 8811',
    company: 'Emirates Steel',
    category: 'client',
    idType: 'passport',
    idNumber: 'PA-88371220',
    hostPerson: 'Priya Sharma — Lead Chemist, Lab 3',
    purpose: 'Client Meeting',
    duration: '2 Hours (until 12:45 PM)',
    allowedZones: 'Building B, Plant floor 2',
    status: 'REGISTERED',
    clearanceStatus: 'APPROVED',
    escortRequired: true,
    entryGateCode: 'GATE-02',
    createdAtDaysAgo: 0,
  },
  {
    id: 'vis-omar',
    visitorCode: '#VIS-4950',
    fullName: 'Omar Farouk',
    phone: '+971 55 882 1043',
    company: 'TalentBridge HR',
    category: 'other',
    idType: 'gov_id',
    idNumber: 'GOI-6644-0099',
    hostPerson: 'Priya Sharma — Lead Chemist, Lab 3',
    purpose: 'Interview',
    duration: '2 Hours (until 11:30 AM)',
    allowedZones: 'Interview room 3, Reception',
    status: 'REGISTERED',
    clearanceStatus: 'PENDING',
    entryGateCode: 'GATE-01',
    createdAtDaysAgo: 0,
  },
];

export function seedVisitors(): Visitor[] {
  return VISITOR_SPECS.map((spec) => {
    const created = dateAtOffset(-(spec.createdAtDaysAgo ?? 0), '07:30');
    const hasEntered = spec.status !== 'REGISTERED';
    return {
      id: spec.id,
      visitorCode: spec.visitorCode,
      fullName: spec.fullName,
      phone: spec.phone,
      company: spec.company,
      category: spec.category,
      idType: spec.idType,
      idNumber: spec.idNumber,
      hostPerson: spec.hostPerson,
      purpose: spec.purpose,
      duration: spec.duration,
      allowedZones: spec.allowedZones,
      photoUrl: null,
      status: spec.status,
      clearanceStatus: spec.clearanceStatus,
      escortRequired: spec.escortRequired ?? false,
      vehicleNo: spec.vehicleNo ?? null,
      notes: spec.notes ?? null,
      entryGateCode: spec.entryGateCode,
      createdAt: created.toISOString(),
      lastEntry: hasEntered
        ? { gateCode: spec.entryGateCode, at: dateAtOffset(-(spec.createdAtDaysAgo ?? 0), '08:15').toISOString() }
        : null,
    };
  });
}

/* ── Visits ─────────────────────────────────────────────────────────────── */
const OPEN_ENTRY_CLOCK: Record<string, string> = {
  'vis-david': '08:42',
  'vis-marcus': '09:05',
  'vis-elena': '07:58',
  'vis-siddharth': '08:16',
  'vis-aisha': '09:34',
};

const OPEN_DWELL_MIN: Record<string, number> = {
  'vis-david': 106,
  'vis-marcus': 83,
  'vis-elena': 128,
  'vis-siddharth': 151,
  'vis-aisha': 54,
};

/** Completed visits seeded for today's `totalExits` and recent activity. */
const CLOSED_TODAY: { visitorId: string; entry: string; exit: string; gate: 'GATE-01' | 'GATE-02' }[] = [
  { visitorId: 'vis-rajeshk', entry: '07:12', exit: '07:44', gate: 'GATE-01' },
  { visitorId: 'vis-sarah', entry: '06:55', exit: '08:02', gate: 'GATE-02' },
];

/** Historical visits (yesterday / earlier) used by the visit-history panel. */
const CLOSED_PAST: { visitorId: string; dayOffset: number; entry: string; exit: string; gate: 'GATE-01' | 'GATE-02' }[] = [
  { visitorId: 'vis-david', dayOffset: -12, entry: '09:10', exit: '12:40', gate: 'GATE-01' },
  { visitorId: 'vis-david', dayOffset: -31, entry: '14:05', exit: '16:20', gate: 'GATE-01' },
  { visitorId: 'vis-marcus', dayOffset: -6, entry: '08:30', exit: '15:10', gate: 'GATE-01' },
  { visitorId: 'vis-elena', dayOffset: -45, entry: '10:00', exit: '13:30', gate: 'GATE-02' },
  { visitorId: 'vis-siddharth', dayOffset: -3, entry: '11:15', exit: '14:05', gate: 'GATE-01' },
  { visitorId: 'vis-sarah', dayOffset: -1, entry: '09:45', exit: '11:50', gate: 'GATE-02' },
  { visitorId: 'vis-sarah', dayOffset: -18, entry: '13:20', exit: '17:00', gate: 'GATE-01' },
  { visitorId: 'vis-luis', dayOffset: -2, entry: '08:05', exit: '10:35', gate: 'GATE-02' },
];

let visitSeq = 0;
function nextVisitId(): string {
  visitSeq += 1;
  return `visit-${String(visitSeq).padStart(4, '0')}`;
}

function expectedExit(entry: Date, duration: string): Date {
  const hours = /(\d+)\s*(?:hour|hr|h)\b/i.exec(duration)?.[1];
  const mins = /(\d+)\s*minute/i.exec(duration)?.[1];
  const d = new Date(entry.getTime());
  if (hours) d.setHours(d.getHours() + Number(hours));
  else if (mins) d.setMinutes(d.getMinutes() + Number(mins));
  else d.setHours(d.getHours() + 8);
  return d;
}

export function seedVisits(visitors: Visitor[]): Visit[] {
  const byId = new Map(visitors.map((v) => [v.id, v]));
  const visits: Visit[] = [];

  const push = (
    visitor: Visitor,
    entryAt: Date,
    exitAt: Date | null,
    gateCode: string,
    notes: string | null = null,
  ) => {
    visits.push({
      id: nextVisitId(),
      visitorId: visitor.id,
      visitorCode: visitor.visitorCode,
      visitorName: visitor.fullName,
      gateCode,
      exitGateCode: exitAt ? gateCode : null,
      status: exitAt ? 'EXITED' : 'INSIDE',
      entryAt: entryAt.toISOString(),
      exitAt: exitAt ? exitAt.toISOString() : null,
      expectedExitAt: expectedExit(entryAt, visitor.duration).toISOString(),
      checklist: [
        { key: 'gov_id', label: 'Government ID verified', passed: true },
        { key: 'host_confirmed', label: 'Host confirmed arrival', passed: true },
        { key: 'safety_briefing', label: 'Safety briefing acknowledged', passed: true },
        { key: 'ppe_issued', label: 'PPE issued where required', passed: true },
      ],
      notes,
    });
  };

  // Currently-open visits.
  for (const spec of VISITOR_SPECS) {
    if (spec.status !== 'INSIDE') continue;
    const visitor = byId.get(spec.id);
    if (!visitor) continue;
    const clock = OPEN_ENTRY_CLOCK[spec.id] ?? '08:30';
    push(visitor, dateAtOffset(0, clock), null, spec.entryGateCode);
  }

  // Today's completed visits.
  for (const closed of CLOSED_TODAY) {
    const visitor = byId.get(closed.visitorId);
    if (!visitor) continue;
    push(visitor, dateAtOffset(0, closed.entry), dateAtOffset(0, closed.exit), closed.gate);
  }

  // Historical visits.
  for (const past of CLOSED_PAST) {
    const visitor = byId.get(past.visitorId);
    if (!visitor) continue;
    push(visitor, dateAtOffset(past.dayOffset, past.entry), dateAtOffset(past.dayOffset, past.exit), past.gate);
  }

  // A few extra historical entries from visitors not otherwise visited, so the
  // directory shows credible lifetime statistics.
  const fillerVisitors = visitors.filter((v) => v.status === 'REGISTERED' && v.clearanceStatus === 'APPROVED');
  for (const visitor of fillerVisitors.slice(0, 3)) {
    push(visitor, dateAtOffset(-between(4, 20), '10:00'), dateAtOffset(-between(4, 20), '12:30'), visitor.entryGateCode);
  }

  return visits;
}

/** Minutes of dwell for an open visit, based on the seeded clock. */
export function seedDwell(visitorId: string): number {
  return OPEN_DWELL_MIN[visitorId] ?? between(20, 180);
}

/* ── Clearances ─────────────────────────────────────────────────────────── */
function buildVisitorClearances(): ClearanceRecord[] {
  return VISITOR_SPECS.map((spec) => {
    const items: ClearanceItemDraft[] = VISITOR_CLEARANCE_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      required: item.required,
      status: spec.clearanceStatus === 'PENDING' ? 'PENDING' : spec.clearanceStatus,
      remarks:
        spec.clearanceStatus === 'REJECTED' && item.key === 'gov_id'
          ? 'Document could not be validated against the watchlist.'
          : spec.clearanceStatus === 'APPROVED'
            ? 'Verified at registration kiosk.'
            : null,
      updatedBy: spec.clearanceStatus === 'PENDING' ? null : 'Rajesh Patil',
      updatedAt: spec.clearanceStatus === 'PENDING' ? null : dateAtOffset(spec.createdAtDaysAgo ?? 0, '07:45').toISOString(),
    }));

    return {
      id: `clr-visitor-${spec.id}`,
      subjectType: 'VISITOR',
      subjectId: spec.id,
      overall: spec.clearanceStatus,
      items,
      updatedBy: spec.clearanceStatus === 'PENDING' ? null : 'Rajesh Patil',
      updatedAt: spec.clearanceStatus === 'PENDING' ? null : dateAtOffset(spec.createdAtDaysAgo ?? 0, '07:45').toISOString(),
    };
  });
}

function buildEmployeeClearances(): ClearanceRecord[] {
  return EMPLOYEES.map((emp) => {
    const items: ClearanceItemDraft[] = EMPLOYEE_CLEARANCE_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      required: item.required,
      status: emp.clearanceStatus,
      remarks: emp.clearanceStatus === 'REJECTED' ? 'Safety induction evidence not supplied.' : 'Verified against HR record.',
      updatedBy: emp.clearanceStatus === 'PENDING' ? null : 'Kavita Pillai',
      updatedAt: emp.clearanceStatus === 'PENDING' ? null : dateAtOffset(-7, '09:20').toISOString(),
    }));

    return {
      id: `clr-employee-${emp.id}`,
      subjectType: 'EMPLOYEE',
      subjectId: emp.id,
      overall: emp.clearanceStatus,
      items,
      updatedBy: emp.clearanceStatus === 'PENDING' ? null : 'Kavita Pillai',
      updatedAt: emp.clearanceStatus === 'PENDING' ? null : dateAtOffset(-7, '09:20').toISOString(),
    };
  });
}

export function seedClearances(): ClearanceRecord[] {
  return [...buildVisitorClearances(), ...buildEmployeeClearances()];
}

/* ── Telemetry ──────────────────────────────────────────────────────────── */
export function seedTelemetry(): Telemetry[] {
  const rows: { employeeId: string; gate: string; type: Telemetry['type']; dayOffset: number; clock: string }[] = [
    { employeeId: 'emp-arjun', gate: 'Gate 01 Turnstile #02', type: 'ENTRY', dayOffset: 0, clock: '07:02' },
    { employeeId: 'emp-arjun', gate: 'Gate 01 Turnstile #02', type: 'EXIT', dayOffset: -1, clock: '18:41' },
    { employeeId: 'emp-farhan', gate: 'Gate 01 Turnstile #01', type: 'ENTRY', dayOffset: 0, clock: '06:48' },
    { employeeId: 'emp-farhan', gate: 'Gate 01 Turnstile #01', type: 'EXIT', dayOffset: -1, clock: '17:12' },
    { employeeId: 'emp-riya', gate: 'Gate 02 Turnstile #01', type: 'ENTRY', dayOffset: 0, clock: '06:55' },
    { employeeId: 'emp-meera', gate: 'Gate 02 Turnstile #01', type: 'ENTRY', dayOffset: 0, clock: '05:12' },
    { employeeId: 'emp-meera', gate: 'Gate 02 Turnstile #01', type: 'EXIT', dayOffset: 0, clock: '12:40' },
    { employeeId: 'emp-suresh', gate: 'Gate 02 Turnstile #02', type: 'ENTRY', dayOffset: -3, clock: '14:02' },
    { employeeId: 'emp-nikhil', gate: 'Gate 01 Turnstile #03', type: 'ENTRY', dayOffset: -9, clock: '08:33' },
    { employeeId: 'emp-vikram', gate: 'Gate 02 Turnstile #02', type: 'EXIT', dayOffset: -21, clock: '16:05' },
  ];

  return rows.map((row, i) => ({
    id: `telemetry-${String(i + 1).padStart(3, '0')}`,
    employeeId: row.employeeId,
    gate: row.gate,
    type: row.type,
    at: dateAtOffset(row.dayOffset, row.clock).toISOString(),
  }));
}

/* ── Other seed counters ────────────────────────────────────────────────── */
/** Visitors expected today beyond those already registered in the seed. */
export const EXPECTED_TODAY_BASE = 34;

export const ALL_SEED = {
  gates: GATES,
  staff: seedStaffRecords,
  visitors: seedVisitors,
  visits: seedVisits,
  employees: EMPLOYEES,
  clearances: seedClearances,
  telemetry: seedTelemetry,
};
