// ---------------------------------------------------------------------------
// roomQr.ts
// Purpose : The room link as a QR code, so a phone or tablet joins by pointing its camera at the host's screen
//           instead of typing an address.
// Usage   : panel.innerHTML += roomQrSvg(link)   (an <svg> that scales to its box; style .yd-qr in duelLink.ts)
// Notes   : Encoded in the page with qrcode-generator 2.0.4 (MIT, no dependencies; ADR 0004 Notes). Nothing is sent
//           anywhere: an online QR service would see every room link. Error correction M (15%) survives a phone
//           camera on a glossy laptop screen; the 2-module quiet zone is drawn white so a dark panel behind it does
//           not break the scan.
// Authored: Written with Claude (Opus 5.5, claude-opus-5-5)
// ---------------------------------------------------------------------------
import qrcode from "qrcode-generator";
import { Log } from "../../core/log";

/** An SVG QR code for `text`, or "" if it cannot be made (the panel still shows the code and the link). */
export function roomQrSvg(text: string): string {
  try {
    const qr = qrcode(0, "M"); // 0: the smallest size that fits
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (err) {
    Log.warn("net", `no QR code for the room link (${String(err)})`);
    return "";
  }
}
