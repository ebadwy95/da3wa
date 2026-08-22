import QRCode from "qrcode";
import { makeCheckinCode } from "./token";

// Generates a PNG data URL for a guest's check-in QR code.
export async function generateGuestQr(guestId) {
  const payload = makeCheckinCode(guestId);
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
  });
  return { payload, dataUrl };
}
