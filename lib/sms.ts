export type SmsConfiguration = {
  username: string;
  password: string;
  sender: string;
};

export type SmsSendResult = {
  id: string;
  status: string;
  parts: number;
  cost?: number;
};

export function normalizeSwedishMobile(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let normalized = value.trim().replace(/[\s()-]/g, "");
  if (normalized.startsWith("0046")) {
    normalized = `+46${normalized.slice(4)}`;
  } else if (/^07\d{8}$/.test(normalized)) {
    normalized = `+46${normalized.slice(1)}`;
  }

  if (!/^\+467\d{8}$/.test(normalized)) {
    throw new Error("Mobilnumret måste vara ett svenskt nummer, exempelvis 0701234567.");
  }

  return normalized;
}

export function smsConfiguration(env: Cloudflare.Env): SmsConfiguration | null {
  const username = env.ELKS_API_USERNAME?.trim();
  const password = env.ELKS_API_PASSWORD?.trim();
  const sender = env.ELKS_SMS_FROM?.trim() || "HedstaOpen";

  if (!username || !password) {
    return null;
  }

  if (!/^[A-Za-z][A-Za-z0-9]{0,10}$/.test(sender)) {
    throw new Error("SMS-avsändaren måste börja med en bokstav och vara högst 11 tecken.");
  }

  return { username, password, sender };
}

export async function sendSms(
  configuration: SmsConfiguration,
  to: string,
  message: string,
  fetcher: typeof fetch = fetch,
) {
  const body = new URLSearchParams({
    from: configuration.sender,
    to,
    message,
  });
  const credentials = btoa(`${configuration.username}:${configuration.password}`);
  const response = await fetcher("https://api.46elks.com/a1/sms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await response.json().catch(() => null)) as (SmsSendResult & { message?: string }) | null;

  if (!response.ok || !data?.id) {
    throw new Error(data?.message || `SMS-tjänsten svarade med status ${response.status}.`);
  }

  return data;
}
