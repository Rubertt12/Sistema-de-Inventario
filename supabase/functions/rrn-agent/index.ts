import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_BODY_BYTES = 128 * 1024;
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'",
};

function reply(status: number, payload: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { ...jsonHeaders, ...extraHeaders } });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function clientIp(req: Request) {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  ];
  return candidates.find((value) => value && value.length < 80) ?? null;
}

function isPrivateIp(ip: string | null) {
  if (!ip) return true;
  return /^(127\.|10\.|192\.168\.|169\.254\.|::1$|fc|fd)/i.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function cleanText(value: unknown, max = 255) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text.slice(0, max) : undefined;
}

function cleanStringArray(value: unknown, maxItems = 32, maxLength = 160) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => cleanText(item, maxLength)).filter(Boolean);
}

function cleanStorage(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 16).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const size = Number(row.size_bytes);
    const free = Number(row.free_bytes);
    return {
      drive: cleanText(row.drive, 24),
      label: cleanText(row.label, 120),
      file_system: cleanText(row.file_system, 32),
      size_bytes: Number.isFinite(size) && size >= 0 ? Math.trunc(size) : null,
      free_bytes: Number.isFinite(free) && free >= 0 ? Math.trunc(free) : null,
    };
  });
}

function cleanInventory(input: unknown) {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const ram = Number(value.ram_bytes);
  return {
    agent_version: cleanText(value.agent_version, 40),
    device_fingerprint: cleanText(value.device_fingerprint, 128),
    hostname: cleanText(value.hostname, 255),
    equipment_type: cleanText(value.equipment_type, 64),
    serial_number: cleanText(value.serial_number, 128),
    asset_tag: cleanText(value.asset_tag, 128),
    manufacturer: cleanText(value.manufacturer, 128),
    model: cleanText(value.model, 192),
    os_name: cleanText(value.os_name, 192),
    os_version: cleanText(value.os_version, 96),
    os_build: cleanText(value.os_build, 64),
    cpu_name: cleanText(value.cpu_name, 192),
    ram_bytes: Number.isFinite(ram) && ram >= 0 ? Math.trunc(ram) : null,
    storage: cleanStorage(value.storage),
    mac_addresses: cleanStringArray(value.mac_addresses, 32, 64),
    ip_addresses: cleanStringArray(value.ip_addresses, 32, 128),
    logged_user: cleanText(value.logged_user, 192),
    domain_name: cleanText(value.domain_name, 192),
    timezone: cleanText(value.timezone, 128),
    collected_at: cleanText(value.collected_at, 80),
  };
}

type LocationPayload = {
  source?: string;
  windows_source?: string;
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
};

function cleanAgentLocation(input: unknown): LocationPayload | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const rawAccuracy = Number(value.accuracy_m ?? value.accuracyM);
  const accuracy = Number.isFinite(rawAccuracy) && rawAccuracy >= 0 && rawAccuracy <= 1000000 ? rawAccuracy : undefined;
  const source = String(value.source || "windows").slice(0, 40).toLowerCase();
  return {
    source,
    windows_source: value.windows_source ? String(value.windows_source).slice(0, 40) : undefined,
    city: value.city ? String(value.city).slice(0, 120) : undefined,
    region: value.region ? String(value.region).slice(0, 120) : undefined,
    country: value.country ? String(value.country).slice(0, 120) : undefined,
    latitude,
    longitude,
    accuracy_m: accuracy,
  };
}

async function locateIp(ip: string | null): Promise<LocationPayload> {
  if (!ip || isPrivateIp(ip)) return {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { "user-agent": "RRN-Agent-Backend/1.1" },
    });
    if (!response.ok) return {};
    const data = await response.json();
    if (!data?.success) return {};
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    return {
      source: "ip",
      city: data.city ? String(data.city).slice(0, 120) : undefined,
      region: data.region ? String(data.region).slice(0, 120) : undefined,
      country: data.country ? String(data.country).slice(0, 120) : undefined,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function locationMode(location: LocationPayload, supplied: boolean) {
  if (!location?.source) return "unavailable";
  if (!supplied && location.source === "ip") return "ip_approximate";
  return location.source;
}

async function allowRequest(keySeed: string, limit: number, windowSeconds: number) {
  try {
    const rateKey = await sha256(keySeed);
    const { data, error } = await admin.rpc("agent_allow_request", {
      p_rate_key: rateKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("RRN rate-limit:", error.message);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("RRN rate-limit exception:", error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return reply(200, { service: "RRN Agent", version: 4, status: "ok", precise_location: true, hardened: true });
  }
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return reply(503, { error: "backend_not_configured" });

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return reply(415, { error: "content_type_not_supported" });
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return reply(413, { error: "payload_too_large" });

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return reply(400, { error: "invalid_body" });
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return reply(413, { error: "payload_too_large" });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "invalid_json" });
  }

  const action = String(body.action || "heartbeat").toLowerCase();
  if (!['enroll', 'heartbeat'].includes(action)) {
    const ip = clientIp(req) || "unknown";
    if (!(await allowRequest(`unknown|${ip}`, 20, 600))) return reply(429, { error: "rate_limited" }, { "retry-after": "600" });
    return reply(400, { error: "unknown_action" });
  }

  const publicIp = clientIp(req);
  const inventory = cleanInventory(body.inventory);
  const agentVersion = String(body.agent_version || inventory.agent_version || "0.1.0").slice(0, 40);
  inventory.agent_version = agentVersion;
  const suppliedLocation = cleanAgentLocation(body.location);

  if (action === "enroll") {
    const ipKey = publicIp || "unknown";
    if (!(await allowRequest(`enroll|${ipKey}`, 30, 600))) return reply(429, { error: "rate_limited" }, { "retry-after": "600" });

    const enrollmentCode = String(body.enrollment_code || "").trim().toUpperCase();
    const fingerprint = String(body.device_fingerprint || inventory.device_fingerprint || "").trim().toLowerCase();
    if (!/^RRN-[A-Z0-9]{12,64}$/.test(enrollmentCode) || !/^[a-f0-9]{64}$/.test(fingerprint)) {
      return reply(400, { error: "invalid_enrollment_data" });
    }

    const location = suppliedLocation ?? await locateIp(publicIp);
    const tokenHash = await sha256(enrollmentCode);
    const agentSecret = randomSecret();
    const secretHash = await sha256(agentSecret);
    const { data, error } = await admin.rpc("consume_agent_enrollment", {
      p_token_hash: tokenHash,
      p_device_fingerprint: fingerprint,
      p_agent_secret_hash: secretHash,
      p_inventory: inventory,
      p_agent_version: agentVersion,
      p_location: location,
      p_public_ip: publicIp,
    });

    if (error) {
      console.error("RRN agent enroll:", error.message);
      const invalid = /invalid_or_expired_enrollment/i.test(error.message || "");
      return reply(invalid ? 401 : 500, { error: invalid ? "invalid_or_expired_enrollment" : "enrollment_failed" });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.device_id) return reply(500, { error: "enrollment_failed" });
    const mode = locationMode(location, Boolean(suppliedLocation));
    return reply(200, {
      ok: true,
      device_id: row.device_id,
      tenant_id: row.tenant_id,
      asset_id: row.asset_id,
      agent_secret: agentSecret,
      location_mode: mode,
      location_accuracy_m: location.accuracy_m ?? null,
      deviceId: row.device_id,
      tenantId: row.tenant_id,
      assetId: row.asset_id,
      agentSecret,
      locationMode: mode,
      locationAccuracyM: location.accuracy_m ?? null,
      schedule: { morning: "08:00", evening: "18:00" },
    });
  }

  const deviceId = String(req.headers.get("x-rrn-device-id") || body.device_id || body.deviceId || "").trim();
  const agentSecret = String(req.headers.get("x-rrn-agent-key") || body.agent_secret || body.agentSecret || "").trim();
  const ipKey = publicIp || "unknown";
  if (!(await allowRequest(`heartbeat-ip|${ipKey}`, 2500, 600))) return reply(429, { error: "rate_limited" }, { "retry-after": "600" });
  if (deviceId && !(await allowRequest(`heartbeat-device|${ipKey}|${deviceId}`, 60, 600))) return reply(429, { error: "rate_limited" }, { "retry-after": "600" });

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId) || agentSecret.length < 32 || agentSecret.length > 256) {
    return reply(401, { error: "missing_or_invalid_agent_credentials" });
  }

  const location = suppliedLocation ?? await locateIp(publicIp);
  const secretHash = await sha256(agentSecret);
  const heartbeatKind = String(body.heartbeat_kind || body.heartbeatKind || "scheduled").slice(0, 32);
  const { data, error } = await admin.rpc("record_agent_heartbeat", {
    p_device_id: deviceId,
    p_agent_secret_hash: secretHash,
    p_inventory: inventory,
    p_agent_version: agentVersion,
    p_heartbeat_kind: heartbeatKind,
    p_location: location,
    p_public_ip: publicIp,
  });

  if (error) {
    console.error("RRN agent heartbeat:", error.message);
    const invalid = /invalid_agent_credentials/i.test(error.message || "");
    return reply(invalid ? 401 : 500, { error: invalid ? "invalid_agent_credentials" : "heartbeat_failed" });
  }

  const receivedAt = new Date().toISOString();
  const mode = locationMode(location, Boolean(suppliedLocation));
  return reply(200, {
    ok: Boolean(data),
    received_at: receivedAt,
    location_mode: mode,
    location_accuracy_m: location.accuracy_m ?? null,
    receivedAt,
    locationMode: mode,
    locationAccuracyM: location.accuracy_m ?? null,
  });
});
