import type { MidiPort } from "./types.js";

export const CUBE_BABY_USB_VENDOR_ID = 0x301a;
export const CUBE_BABY_USB_PRODUCT_ID = 0x5555;

export type CubeBabyMatch = "confirmed" | "candidate" | "none";

export function classifyCubeBabyPort(port: MidiPort): CubeBabyMatch {
  if (port.vendorId === CUBE_BABY_USB_VENDOR_ID && port.productId === CUBE_BABY_USB_PRODUCT_ID) {
    return "confirmed";
  }

  return /\b(?:sinco[\s-]*)?cube[\s-]*baby\b/i.test(port.name) ? "candidate" : "none";
}
