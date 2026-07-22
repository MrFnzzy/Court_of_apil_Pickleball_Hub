// Court of Apil Pickleball Hub — Database schema
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum BookingStatus {
  PENDING   // awaiting admin approval of proof of payment
  CONFIRMED // approved, confirmation email sent
  REJECTED  // proof of payment rejected / invalid
  CANCELLED // cancelled by admin
}

enum PaymentMethod {
  GCASH
  MAYA
  BPI
}

// One row per booking "order" — can cover multiple hourly slots in one day
model Booking {
  id              String        @id @default(uuid())
  customerName    String
  contactNumber   String // 11-digit numeric, validated in app layer
  email           String

  date            DateTime      // the calendar date being booked (stored at 00:00 UTC)
  startHours      Int[]         // list of starting hours (0-23) booked, e.g. [14,15] = 2PM & 3PM

  courtTotal      Float         // sum of per-slot court prices
  paddleCount     Int           @default(0) // 0, 1, or 2 (rental package)
  rentalTotal     Float         @default(0)
  grandTotal      Float

  paymentMethod   PaymentMethod
  referenceNumber String
  amountSent      Float
  proofOfPaymentUrl String

  status          BookingStatus @default(PENDING)
  adminNote       String?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  slots           Slot[]

  @@index([date])
}

// One row per individual hour-slot that is held/booked — the UNIQUE constraint
// on (date, hour) is what guarantees no double-booking can ever occur, even
// under concurrent requests.
model Slot {
  id        String   @id @default(uuid())
  date      DateTime // date this slot belongs to (00:00 UTC)
  hour      Int      // 0-23

  bookingId String
  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([date, hour])
  @@index([date])
}

// Admin-managed payment accounts shown to customers at checkout
model PaymentAccount {
  id            String        @id @default(uuid())
  method        PaymentMethod
  accountName   String
  accountNumber String
  qrImageUrl    String?
  active        Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

// Single-row table (id is always "singleton") holding admin-editable pricing.
// Court pricing: weekday day-time, weekday night-time, weekend (all hours).
// Rental pricing: 1-paddle and 2-paddle packages.
model PricingSettings {
  id                String   @id
  weekdayDayPrice   Float    @default(200)
  weekdayNightPrice Float    @default(250)
  weekendPrice      Float    @default(250)
  rental1Price      Float    @default(100)
  rental2Price      Float    @default(150)
  updatedAt         DateTime @updatedAt
}
