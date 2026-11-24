// ---------------------------------------------------------------------------
// roomQr.test.ts
// Purpose : The room link becomes a scalable SVG QR code (src/game/net/roomQr.ts), and a link too long for any QR
//           size gives "" (the panel then just shows the code and the link) instead of a throw.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { roomQrSvg } from "../src/game/net/roomQr";

describe("roomQrSvg", () => {
  it("makes a scalable SVG with a white quiet zone for a room link", () => {
    const svg = roomQrSvg("https://192.168.1.171:5180/?play&level=duel&room=WFFD");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    expect(svg).not.toMatch(/width="\d+px"/); // scalable: sized by its box
    expect(svg).toContain('fill="white"');
  });

  it("gives an empty string when the text cannot fit in a QR code", () => {
    expect(roomQrSvg("x".repeat(5000))).toBe("");
  });
});
