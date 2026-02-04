type UbibotChannelResponse = {
  result?: string;
  server_time?: string;
  channels?: any[];
  channel?: any;
  errorCode?: string;
  desp?: string;
};

export type UbibotChannel = {
  channel_id: string;
  name?: string;
  last_entry_date?: string;
  net?: string | number;
  last_values?: any;
  vconfig?: any;
  [k: string]: any;
};

export type UbibotMetricKey = "temp" | "rh" | "light" | "voltage" | "rssi";

export type UbibotField = `field${number}`;

export type UbibotFieldMap = Partial<Record<UbibotMetricKey, UbibotField>>;

export type UbibotChannelSnapshot = {
  channelId: string;
  channel?: UbibotChannel;
  fieldLabels: Partial<Record<UbibotField, string>>;
  fieldMap: UbibotFieldMap;
  units: Partial<Record<UbibotMetricKey, string>>;
  values: Partial<Record<UbibotMetricKey, number>>;
  sampledAt?: Date;
};

function inferUnitFromLabel(label: string | undefined): string | undefined {
  const s = (label || "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("temp")) return "°C";
  if (s.includes("humid")) return "%";
  if (s.includes("light") || s.includes("lux")) return "lux";
  if (s.includes("volt")) return "V";
  if (s.includes("rssi") || s.includes("wifi")) return "dBm";
  return undefined;
}

function safeJsonParse<T>(value: any): T | undefined {
  if (value == null) return undefined;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function pickFieldLabels(channel: UbibotChannel): Partial<Record<UbibotField, string>> {
  const labels: Partial<Record<UbibotField, string>> = {};
  for (let i = 1; i <= 10; i++) {
    const key = `field${i}` as UbibotField;
    const val = (channel as any)[key];
    if (typeof val === "string" && val.trim()) labels[key] = val.trim();
  }
  return labels;
}

function buildFieldMapFromLabels(labels: Partial<Record<UbibotField, string>>): UbibotFieldMap {
  const map: UbibotFieldMap = {};
  for (const [field, label] of Object.entries(labels) as Array<[UbibotField, string]>) {
    const l = label.toLowerCase();
    if (!map.temp && l.includes("temp")) map.temp = field;
    if (!map.rh && (l.includes("humid") || l.includes("rh"))) map.rh = field;
    if (!map.light && l.includes("light")) map.light = field;
    if (!map.voltage && l.includes("volt")) map.voltage = field;
    if (!map.rssi && (l.includes("rssi") || l.includes("wifi"))) map.rssi = field;
  }
  return map;
}

function normalizeLastValues(lastValuesRaw: any): Record<string, { value?: any; created_at?: any }> {
  const parsed = safeJsonParse<Record<string, any>>(lastValuesRaw) || (typeof lastValuesRaw === "object" ? lastValuesRaw : undefined);
  if (!parsed || typeof parsed !== "object") return {};
  const out: Record<string, { value?: any; created_at?: any }> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!v || typeof v !== "object") continue;
    out[k] = { value: (v as any).value, created_at: (v as any).created_at };
  }
  return out;
}

export async function ubibotViewChannel(channelId: string, accountKey?: string): Promise<UbibotChannel> {
  const key = accountKey || process.env.UBIBOT_ACCOUNT_KEY;
  if (!key) {
    throw new Error("UBIBOT_ACCOUNT_KEY is not configured");
  }
  const base = process.env.UBIBOT_BASE_URL || "https://api.ubibot.com";
  const url = `${base.replace(/\/$/, "")}/channels/${encodeURIComponent(channelId)}?account_key=${encodeURIComponent(key)}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const resp = await fetch(url, { method: "GET", cache: "no-store", signal: ctrl.signal });
    const json = (await resp.json().catch(() => null)) as UbibotChannelResponse | null;
    if (!resp.ok) {
      const msg = json?.desp || `Ubibot request failed (${resp.status})`;
      throw new Error(msg);
    }
    if (json?.channel) {
      return json.channel as UbibotChannel;
    }
    if (json?.channels?.length) {
      return json.channels[0] as UbibotChannel;
    }
    throw new Error("Ubibot channel not found");
  } finally {
    clearTimeout(t);
  }
}

export function buildUbibotSnapshot(channelId: string, channel: UbibotChannel, storedMap?: UbibotFieldMap): UbibotChannelSnapshot {
  const fieldLabels = pickFieldLabels(channel);
  const inferredMap = buildFieldMapFromLabels(fieldLabels);
  const fieldMap: UbibotFieldMap = { ...inferredMap, ...(storedMap || {}) };

  const lastValues = normalizeLastValues(channel.last_values);

  const values: UbibotChannelSnapshot["values"] = {};
  const units: UbibotChannelSnapshot["units"] = {};

  const metricKeys: UbibotMetricKey[] = ["temp", "rh", "light", "voltage", "rssi"];
  let sampledAt: Date | undefined;

  for (const mk of metricKeys) {
    const field = fieldMap[mk];
    if (!field) continue;
    const rec = lastValues[field];
    const rawVal = rec?.value;
    const num = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
    if (!Number.isFinite(num)) continue;
    values[mk] = num;

    const label = fieldLabels[field];
    const u = inferUnitFromLabel(label);
    if (u) units[mk] = u;

    const created = rec?.created_at;
    let ts = 0;
    if (typeof created === "number") {
      ts = created * 1000;
    } else if (typeof created === "string") {
      // Try parsing as ISO date first
      const d = new Date(created);
      if (!isNaN(d.getTime())) {
        ts = d.getTime();
      } else {
        // Fallback to float timestamp if it's a string number
        ts = parseFloat(created) * 1000;
      }
    }
    
    if (Number.isFinite(ts) && ts > 0 && (!sampledAt || ts > sampledAt.getTime())) {
      sampledAt = new Date(ts);
    }
  }

  return {
    channelId,
    channel,
    fieldLabels,
    fieldMap,
    units,
    values,
    sampledAt,
  };
}

export function pickPrimaryMetricForSensorType(sensorType: string | undefined): UbibotMetricKey {
  const t = (sensorType || "").toLowerCase();
  if (t.includes("humid")) return "rh";
  if (t.includes("light")) return "light";
  if (t.includes("volt")) return "voltage";
  if (t.includes("rssi") || t.includes("wifi")) return "rssi";
  return "temp";
}

export function formatMetricValue(value: number | undefined, unit: string | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = unit === "%" ? Math.round(value) : Math.round(value * 10) / 10;
  return unit ? `${rounded}${unit}` : `${rounded}`;
}


export function estimateBatteryPercentage(voltage: number | undefined): number {
  if (voltage === undefined || !Number.isFinite(voltage)) return 100; // Assume plugged in/unknown
  if (voltage >= 4.5) return 100;
  if (voltage <= 3.6) return 0;
  return Math.round(((voltage - 3.6) / (4.5 - 3.6)) * 100);
}


export function estimateSignalStrength(rssi: number | undefined): number {
  if (rssi === undefined || !Number.isFinite(rssi)) return 4; // Assume good if unknown
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}

