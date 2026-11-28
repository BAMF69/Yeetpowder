import { describe, expect, it } from "vitest";
import { DEFAULT_MENU_TYPE, menuType } from "../src/shell/menuType";

describe("menu lettering", () => {
  it("is the worn-edge stencil unless asked otherwise", () => {
    expect(DEFAULT_MENU_TYPE).toBe("stencil");
    expect(menuType(new URLSearchParams(""))).toBe("stencil");
  });
  it("previews the kept alternatives and refuses anything else", () => {
    expect(menuType(new URLSearchParams("menu-type=riveted"))).toBe("riveted");
    expect(menuType(new URLSearchParams("menu-type=engraved"))).toBe("engraved");
    expect(menuType(new URLSearchParams("menu-type=<script>"))).toBe("stencil");
  });
});
