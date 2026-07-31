import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * A QR code as inline SVG.
 *
 * SVG rather than a canvas because it scales to whatever size the sheet gives
 * it without going soft, prints correctly, and needs no ref or effect — the
 * whole thing is a pure function of the string.
 *
 * Type number 0 lets the library pick the smallest version that fits. Error
 * correction stays at M: a phone camera pointed at a bright screen has plenty
 * of margin, and the higher levels would grow the code — a denser grid is
 * harder to scan across a room, which is exactly the situation this exists for.
 */
export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const path = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    // One path with a subpath per dark module beats one <rect> each: a version-6
    // code is ~1700 modules, and that many elements is a visibly slower sheet.
    const parts: string[] = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) parts.push(`M${col} ${row}h1v1h-1z`);
      }
    }
    return { d: parts.join(""), count };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      // The quiet zone is part of the spec, not padding: without four modules
      // of margin many scanners refuse to find the code at all.
      viewBox={`-4 -4 ${path.count + 8} ${path.count + 8}`}
      shapeRendering="crispEdges"
      className="rounded-sm"
      style={{ background: "#ffffff" }}
    >
      {/* Always black on white, whatever the theme. A QR code inverted or
          tinted to match the accent is a QR code many scanners reject. */}
      <path d={path.d} fill="#000000" />
    </svg>
  );
}
