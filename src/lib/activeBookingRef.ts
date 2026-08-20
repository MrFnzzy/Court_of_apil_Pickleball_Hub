// localStorage key holding the bookingRef of a booking this browser just
// submitted that's still awaiting admin approval. Shared between the /book
// success flow (which sets it) and PendingBookingLock (which reads it and
// clears it once the booking is resolved) and the /track/[ref] page (which
// also clears it if the ref turns out to be resolved or invalid).
export const ACTIVE_BOOKING_REF_KEY = "hph_active_booking_ref";
