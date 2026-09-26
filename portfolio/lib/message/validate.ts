import type { MessageDraft } from "@/lib/terminal/types";

// Match apps.portfolio's message view, so the form refuses what the backend would.
export const MAX_MESSAGE_CHARS = 5000;
export const MAX_NAME_CHARS = 200;

export type DraftErrors = Partial<Record<keyof MessageDraft, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDraft(draft: MessageDraft): DraftErrors {
  const errors: DraftErrors = {};
  const email = draft.email.trim();
  if (!email) errors.email = "needed, so I can reply";
  else if (!EMAIL.test(email)) errors.email = "that doesn't look like an email address";
  const text = draft.text.trim();
  if (!text) errors.text = "say a little about what you have in mind";
  else if (text.length > MAX_MESSAGE_CHARS) errors.text = `keep it under ${MAX_MESSAGE_CHARS} characters`;
  if (draft.name.length > MAX_NAME_CHARS) errors.name = `keep it under ${MAX_NAME_CHARS} characters`;
  return errors;
}

export const hasErrors = (errors: DraftErrors) => Object.keys(errors).length > 0;
