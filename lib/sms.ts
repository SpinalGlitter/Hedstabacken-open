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

const GSM_BASIC_CHARACTERS = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split(""),
);
const GSM_EXTENDED_CHARACTERS = new Set("^{}\\[~]|€".split(""));

export function estimateSmsParts(message: string) {
  if (!message) {
    return 0;
  }

  let gsmUnits = 0;
  for (const character of message) {
    if (GSM_BASIC_CHARACTERS.has(character)) {
      gsmUnits += 1;
    } else if (GSM_EXTENDED_CHARACTERS.has(character)) {
      gsmUnits += 2;
    } else {
      const unicodeUnits = message.length;
      return unicodeUnits <= 70 ? 1 : Math.ceil(unicodeUnits / 67);
    }
  }

  return gsmUnits <= 160 ? 1 : Math.ceil(gsmUnits / 153);
}

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
