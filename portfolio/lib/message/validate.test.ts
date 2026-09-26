import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_CHARS, hasErrors, validateDraft } from "./validate";

const draft = (over: Partial<{ name: string; email: string; text: string }> = {}) => ({
  name: "",
  email: "ada@example.com",
  text: "Hello",
  ...over,
});

describe("validateDraft", () => {
  it("accepts a message with no name", () => {
    expect(hasErrors(validateDraft(draft()))).toBe(false);
  });

  it("needs an email and a message", () => {
    expect(validateDraft(draft({ email: " ", text: "" }))).toEqual({
      email: "needed, so I can reply",
      text: "say a little about what you have in mind",
    });
  });

  it("rejects an address the backend would refuse", () => {
    expect(validateDraft(draft({ email: "ada@example" })).email).toMatch(/doesn't look like/);
  });

  it("enforces the backend's length limit", () => {
    expect(validateDraft(draft({ text: "x".repeat(MAX_MESSAGE_CHARS + 1) })).text).toMatch(/under 5000/);
  });
});
