import { Resend } from "resend";
import { labelForSlot } from "./pricing";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendConfirmationEmail(booking: {
  email: string;
  customerName: string;
  date: Date;
  startHours: number[];
  courtTotal: number;
  rentalTotal: number;
  grandTotal: number;
  paddleCount: number;
  referenceNumber: string;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping email send.");
    return;
  }

  const dateStr = booking.date.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const slotsHtml = [...booking.startHours]
    .sort((a, b) => a - b)
    .map((h) => `<li>${labelForSlot(h)}</li>`)
    .join("");

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Court of Apil <onboarding@resend.dev>",
    to: booking.email,
    subject: "Your Court of Apil booking is confirmed! 🏓",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#F46036;padding:24px;border-radius:16px 16px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Booking Confirmed 🏓</h1>
        </div>
        <div style="border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 16px 16px;">
          <p>Hi ${booking.customerName},</p>
          <p>Your payment has been verified and your court reservation at <strong>Court of Apil Pickleball Hub</strong> is now confirmed.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Time slot(s)</td><td style="padding:6px 0;font-weight:600;"><ul style="margin:0;padding-left:18px;">${slotsHtml}</ul></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Court fee</td><td style="padding:6px 0;">₱${booking.courtTotal.toFixed(2)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Rental fee</td><td style="padding:6px 0;">₱${booking.rentalTotal.toFixed(2)}</td></tr>
            <tr><td style="padding:8px 0;color:#173A45;font-weight:700;">Total paid</td><td style="padding:8px 0;font-weight:700;">₱${booking.grandTotal.toFixed(2)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Reference #</td><td style="padding:6px 0;">${booking.referenceNumber}</td></tr>
          </table>
          <p>See you on the court! Please arrive a few minutes early. Free parking is available on-site.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">Court of Apil Pickleball Hub — Talisay City, Cebu</p>
        </div>
      </div>
    `,
  });
}
