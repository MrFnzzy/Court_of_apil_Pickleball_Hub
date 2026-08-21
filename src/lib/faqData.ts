export type FAQEntry = { q: string; a: string; link?: string; linkLabel?: string };

export const FAQ_ENTRIES: FAQEntry[] = [
  {
    q: "Do you accept walk-ins?",
    a: "Yes, walk-ins are allowed from 8AM - 8PM but is subject to court availability.",
  },
  {
    q: "Do you allow rebooking?",
    a: "Yes, rebooking is allowed 3 hours prior to the original schedule booked and is subject to court availability.",
  },
  {
    q: "Do you allow booking cancellation?",
    a: "No, all payments made are non-refundable. Only rebooking/rescheduling is allowed.",
  },
  {
    q: "Do you have parking available?",
    a: "Yes, up to 6 cars can be parked in our designated parking area.",
  },
  {
    q: "What happens when it rains during our booked schedule?",
    a: "When it rains during your booked schedule, we can reschedule your slot to another date/time, subject to court availability.",
  },
  {
    q: "Where are you located?",
    a: "We are located just in front of Tangke, Talisay City Barangay Hall. You can also click this link below to see our exact location:",
    link: "https://maps.app.goo.gl/LrX98PbJZTKfx1C18?g_st=ac",
  },
  {
    q: "Where can we check for available schedules and book our slot?",
    a: "You can scan this qr code below to access our website or use this link:",
    link: "https://www.heidespickleballhub.com",
    linkLabel: "www.heidespickleballhub.com",
  },
  {
    q: "What are your court rates?",
    a: "We currently have our soft opening promo happening now at ₱200 per hour only.",
  },
  {
    q: "Do you have paddles and balls available for rent?",
    a: "Yes, we have paddles available for rent and balls available for purchase.\n\n1 paddle - ₱100\n2 paddles - ₱150\n1 ball - ₱50\n3 balls - ₱120",
  },
];
