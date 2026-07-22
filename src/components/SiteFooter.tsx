import BallIcon from "./icons/BallIcon";

export default function SiteFooter() {
  return (
    <footer className="mt-20 bg-court-ink text-court-cream/90">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BallIcon className="h-6 w-6 text-court-blue" />
            <p className="font-display font-700 text-lg text-white">Court of Apil</p>
          </div>
          <p className="text-sm text-court-cream/70">
            An exclusive outdoor pickleball court in Talisay City, Cebu. Open 24/7, with paddle & ball
            rentals and free parking.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white mb-2 text-sm uppercase tracking-wide">Location</p>
          <p className="text-sm text-court-cream/70">Talisay City, Cebu, Philippines</p>
          <a
            href="https://maps.app.goo.gl/5cj5BP3vJSMy94p48?g_st=afm"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-court-blue hover:underline inline-block mt-1 focus-ring"
          >
            Open in Google Maps →
          </a>
        </div>
        <div>
          <p className="font-semibold text-white mb-2 text-sm uppercase tracking-wide">Hours</p>
          <p className="text-sm text-court-cream/70">Open 24 hours a day, every day.</p>
          <p className="text-sm text-court-cream/70 mt-1">Court manager login: <a href="/admin/login" className="text-court-blue hover:underline focus-ring">/admin</a></p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-court-cream/50">
        © {new Date().getFullYear()} Court of Apil Pickleball Hub. All rights reserved.
      </div>
    </footer>
  );
}
