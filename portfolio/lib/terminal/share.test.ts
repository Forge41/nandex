import { describe, expect, it } from "vitest";

import { shareableCommands } from "./share";
import type { Entry } from "./types";

const cmd = (text: string) => ({ id: 0, kind: "cmd", text, mode: "slash" }) as unknown as Entry;

describe("shareable commands", () => {
  it("never replays commands that would leave or restart the page", () => {
    const entries = ["/help", "/reload", "/interview", "/sources"].map(cmd);
    expect(shareableCommands(entries)).toEqual(["/help", "/sources"]);
  });
});
