import { describe, expect, it } from "vitest";
import { OPERATORS } from "../src/net/profile";
import { hasOperatorIcon } from "../src/shell/operatorIcons";

describe("operator icons", () => {
  it("every operator has its own icon", () => {
    expect(Object.keys(OPERATORS).filter((id) => !hasOperatorIcon(id))).toEqual([]);
  });
  it("uses the renamed display names (Elaina, 2026-11-27)", () => {
    expect(OPERATORS["samurai-titan"].name).toBe("Viking");
    expect(OPERATORS["samurai-warrior"].name).toBe("Samurai");
    expect(OPERATORS["shadow-vanguard"].name).toBe("Black Ops");
    expect(OPERATORS["tactical-shadow-4000"].name).toBe("Black Widow");
  });
});
