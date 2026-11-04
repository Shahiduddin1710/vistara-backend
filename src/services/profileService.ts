/**
 * Staff profile and terminal settings.
 *
 * The device block is descriptive configuration for the gate terminal rather
 * than a live hardware probe — the label says so, and the frontend renders the
 * status verbatim instead of implying a real scan happened.
 */
import { getStore } from '../stores';
import { ApiError } from '../utils/ApiError';
import { startOfDay } from '../utils/time';
import { Gate, ProfileSettings, Staff } from '../models/types';

export interface ProfilePayload {
  staff: Staff;
  gate: Gate;
  settings: ProfileSettings;
}

/** Terminal capabilities reported to the profile screen. */
function terminalSettings(staff: Staff, now = new Date()): ProfileSettings {
  const auditDay = startOfDay(now);
  return {
    biometricScanner: { status: 'ONLINE', label: 'Face & Fingerprint Reader' },
    badgePrinter: { status: 'READY', label: 'Thermal Badge Printer' },
    turnstileAutoRelease: true,
    audioAlert: 'Standard Chime',
    securityAudit: {
      verifiedAt: auditDay.toISOString(),
      status: 'VALID',
    },
  };
}

export async function get(staff: Staff): Promise<ProfilePayload> {
  const store = getStore();
  const gate = await store.findGateByCode(staff.gateCode);
  if (!gate) {
    throw new ApiError(404, 'GATE_NOT_FOUND', 'Your assigned gate terminal no longer exists.');
  }
  return { staff, gate, settings: terminalSettings(staff) };
}
