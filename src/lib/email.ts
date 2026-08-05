import nodemailer from "nodemailer";
import { labelForSlot } from "./pricing";

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

// The admin's own inbox, used as the default recipient for internal
// notifications (e.g. manual booking alerts) when no override is configured
// in Site Settings.
export function defaultAdminEmail(): string | undefined {
  return gmailUser;
}

const transporter =
  gmailUser && gmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      })
    : null;

async function sendMail(to: string, subject: string, html: string) {
  if (!transporter || !gmailUser) {
    console.warn("GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email send.");
    return;
  }
  await transporter.sendMail({
    from: `"Heide's Pickleball Hub" <${gmailUser}>`,
    to,
    subject,
    html,
  });
}

export async function sendConfirmationEmail(booking: {
  email: string;
  customerName: string;
  date: Date;
  startHours: number[];
  courtTotal: number;
  rentalTotal: number;
  ballTotal: number;
  grandTotal: number;
  paddleCount: number;
  referenceNumber: string;
}) {
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

  const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#F46036;padding:24px;border-radius:16px 16px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Booking Confirmed 🏓</h1>
        </div>
        <div style="border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 16px 16px;">
          <p>Hi ${booking.customerName},</p>
          <p>Your payment has been verified and your court reservation at <strong>Heide's Pickleball Hub</strong> is now confirmed.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Time slot(s)</td><td style="padding:6px 0;font-weight:600;"><ul style="margin:0;padding-left:18px;">${slotsHtml}</ul></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Court fee</td><td style="padding:6px 0;">₱${booking.courtTotal.toFixed(2)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Paddle rental fee</td><td style="padding:6px 0;">₱${booking.rentalTotal.toFixed(2)}</td></tr>
            ${booking.ballTotal > 0 ? `<tr><td style="padding:6px 0;color:#666;">Ball rental fee</td><td style="padding:6px 0;">₱${booking.ballTotal.toFixed(2)}</td></tr>` : ""}
            <tr><td style="padding:8px 0;color:#173A45;font-weight:700;">Total paid</td><td style="padding:8px 0;font-weight:700;">₱${booking.grandTotal.toFixed(2)}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Reference #</td><td style="padding:6px 0;">${booking.referenceNumber}</td></tr>
          </table>
          <p>See you on the court! Please arrive a few minutes early. Free parking is available on-site.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">Heide's Pickleball Hub — Talisay City, Cebu</p>
        </div>
      </div>
    `;

  await sendMail(booking.email, "Your Heide's Pickleball Hub booking is confirmed! 🏓", html);
}

export async function sendRejectionEmail(booking: {
  email: string;
  customerName: string;
  date: Date;
  startHours: number[];
  referenceNumber: string;
  reason?: string | null;
}) {
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

  const reasonText = booking.reason?.trim() || "We couldn't verify your payment details.";

  const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#173A45;padding:24px;border-radius:16px 16px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Booking Not Confirmed</h1>
        </div>
        <div style="border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 16px 16px;">
          <p>Hi ${booking.customerName},</p>
          <p>Unfortunately, we weren't able to confirm your court reservation at <strong>Heide's Pickleball Hub</strong> for the slot below.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Time slot(s)</td><td style="padding:6px 0;font-weight:600;"><ul style="margin:0;padding-left:18px;">${slotsHtml}</ul></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Reference #</td><td style="padding:6px 0;">${booking.referenceNumber}</td></tr>
          </table>
          <p style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px 14px;color:#991B1B;"><strong>Reason:</strong> ${reasonText}</p>
          <p>Your slot has been released and is now available for others to book. If you believe this was a mistake, or if you'd like to try again with a clearer proof of payment, please make a new booking or contact us directly.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">Heide's Pickleball Hub — Talisay City, Cebu</p>
        </div>
      </div>
    `;

  await sendMail(booking.email, "Update on your Heide's Pickleball Hub booking", html);
}

// Sent to the venue's own inbox (adminNotificationEmail, falling back to
// GMAIL_USER) every time an admin adds a manual/walk-in booking from the
// dashboard, so there's always an email record of it even outside the DB.
export async function sendManualBookingAdminNotification(
  to: string,
  booking: {
    customerName: string;
    contactNumber: string;
    email: string;
    date: Date;
    startHours: number[];
    courtTotal: number;
    rentalTotal: number;
    ballTotal: number;
    grandTotal: number;
    status: string;
    adminNote?: string | null;
  }
) {
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

  const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#173A45;padding:24px;border-radius:16px 16px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">New manual booking added</h1>
        </div>
        <div style="border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 16px 16px;">
          <p>A manual booking was just added from the admin dashboard.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#666;">Customer</td><td style="padding:6px 0;font-weight:600;">${booking.customerName}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Contact</td><td style="padding:6px 0;">${booking.contactNumber || "—"}${booking.email ? ` · ${booking.email}` : ""}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Time slot(s)</td><td style="padding:6px 0;font-weight:600;"><ul style="margin:0;padding-left:18px;">${slotsHtml}</ul></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Status</td><td style="padding:6px 0;">${booking.status}</td></tr>
            <tr><td style="padding:8px 0;color:#173A45;font-weight:700;">Total</td><td style="padding:8px 0;font-weight:700;">₱${booking.grandTotal.toFixed(2)}</td></tr>
            ${booking.adminNote ? `<tr><td style="padding:6px 0;color:#666;">Note</td><td style="padding:6px 0;">${booking.adminNote}</td></tr>` : ""}
          </table>
          <p style="color:#999;font-size:12px;margin-top:24px;">Heide's Pickleball Hub — Talisay City, Cebu</p>
        </div>
      </div>
    `;

  await sendMail(to, `Manual booking added — ${booking.customerName} (${dateStr})`, html);
}

// Base URL used to build the feedback link. Falls back to Vercel's
// auto-provided deployment URL, then to localhost for local dev, so this
// works out of the box without extra setup — but it's best set explicitly
// via NEXT_PUBLIC_SITE_URL once you're on a custom domain.
function siteBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// Sent once a CONFIRMED booking's reserved time has fully passed. Thanks the
// player, and links to a short feedback form (built with feedbackToken) so
// they can rate the venue/service/value and leave a comment.
export async function sendFeedbackRequestEmail(booking: {
  email: string;
  customerName: string;
  date: Date;
  startHours: number[];
  feedbackToken: string;
}) {
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

  const feedbackUrl = `${siteBaseUrl()}/feedback/${booking.feedbackToken}`;

  const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#F46036;padding:24px;border-radius:16px 16px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;">Thanks for playing! 🏓</h1>
        </div>
        <div style="border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 16px 16px;">
          <p>Hi ${booking.customerName},</p>
          <p>Thanks for playing — or booking — with <strong>Heide's Pickleball Hub</strong>! We hope you had a great time on the court.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Time slot(s)</td><td style="padding:6px 0;font-weight:600;"><ul style="margin:0;padding-left:18px;">${slotsHtml}</ul></td></tr>
          </table>
          <p>We'd love to hear how it went. Your feedback helps us make your next booking even better.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${feedbackUrl}" style="display:inline-block;background:#F46036;color:white;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:999px;">Share your feedback</a>
          </div>
          <p style="color:#999;font-size:12px;">It only takes a minute — a few quick ratings and an optional comment.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">Heide's Pickleball Hub — Talisay City, Cebu</p>
        </div>
      </div>
    `;

  await sendMail(booking.email, "Thanks for playing with Heide's Pickleball Hub — how did we do? 🏓", html);
}
