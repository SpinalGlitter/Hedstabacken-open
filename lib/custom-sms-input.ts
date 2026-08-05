const MAX_MESSAGE_LENGTH = 480;

export function validateCustomSms(input: {
  message?: unknown;
  recipientIds?: unknown;
  requestId?: unknown;
}) {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  const rawRecipientIds = Array.isArray(input.recipientIds) ? input.recipientIds : [];
  const recipientIds = [...new Set(rawRecipientIds.map(Number))];

  if (message.length < 1 || message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Meddelandet måste vara mellan 1 och ${MAX_MESSAGE_LENGTH} tecken.`);
  }

  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestId)) {
    throw new Error("Utskickets ID är ogiltigt.");
  }

  if (
    recipientIds.length === 0 ||
    recipientIds.some((memberId) => !Number.isSafeInteger(memberId) || memberId < 1)
  ) {
    throw new Error("Välj minst en giltig mottagare.");
  }

  return { message, recipientIds, requestId };
}
