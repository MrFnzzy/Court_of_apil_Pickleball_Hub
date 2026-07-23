import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MapToggle from "@/components/MapToggle";
import HomeScheduleSection from "@/components/HomeScheduleSection";
import BallIcon from "@/components/icons/BallIcon";
import PaddleIcon from "@/components/icons/PaddleIcon";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-court-blue-light/60 text-court-blue-dark px-3 py-1 text-xs font-bold uppercase tracking-widest">
                <BallIcon className="h-3.5 w-3.5" /> Open 24/7 · Talisay City, Cebu
              </span>
              <h1 className="font-display font-700 text-4xl sm:text-5xl leading-[1.05] mt-5 text-court-ink">
                Court of Apil
                <span className="block text-court-orange">Pickleball Hub</span>
              </h1>
              <p className="mt-5 text-lg text-court-ink/75 max-w-xl">
                An exclusive outdoor pickleball court in Talisay City, Cebu — open around the clock, with
                paddle &amp; ball rentals on-site and free parking for every player.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/book"
                  className="focus-ring inline-flex items-center gap-2 rounded-full bg-court-orange text-white px-6 py-3.5 font-semibold shadow-court-lg hover:bg-court-orange-dark transition-colors"
                >
                  <PaddleIcon className="h-5 w-5" /> Book a slot
                </Link>
                <a
                  href="#pricing"
                  className="focus-ring inline-flex items-center gap-2 rounded-full border-2 border-court-ink/15 px-6 py-3.5 font-semibold text-court-ink hover:border-court-orange/60 transition-colors"
                >
                  See pricing
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-court overflow-hidden shadow-court-lg border-4 border-white relative aspect-[4/3] bg-gradient-to-br from-court-blue via-court-blue-light to-court-orange-light">
                {/* Court illustration */}
                <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
                  <rect width="400" height="300" fill="#2FA8D9" />
                  <rect x="30" y="30" width="340" height="240" rx="6" fill="#3FBEEF" stroke="white" strokeWidth="4" />
                  <line x1="200" y1="30" x2="200" y2="270" stroke="white" strokeWidth="4" />
                  <rect x="115" y="30" width="170" height="240" fill="none" stroke="white" strokeWidth="3" strokeDasharray="1 0" />
                  <line x1="115" y1="30" x2="115" y2="270" stroke="white" strokeWidth="3" />
                  <line x1="285" y1="30" x2="285" y2="270" stroke="white" strokeWidth="3" />
                  <line x1="30" y1="150" x2="370" y2="150" stroke="white" strokeWidth="4" />
                  <circle cx="200" cy="150" r="14" fill="#F46036" opacity="0.9" />
                </svg>
                <div className="absolute inset-0 bg-court-ink/10" />
              </div>
              <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-court px-4 py-3 flex items-center gap-3 border border-court-orange/20">
                <span className="h-9 w-9 rounded-full bg-court-orange/10 flex items-center justify-center">
                  <PaddleIcon className="h-5 w-5 text-court-orange" />
                </span>
                <div>
                  <p className="text-xs text-court-ink/60 leading-none">Rentals available</p>
                  <p className="font-display font-600 text-sm text-court-ink">Paddles &amp; balls on-site</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT + MAP */}
        <section className="bg-white border-y-2 border-court-orange/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid md:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="font-display font-700 text-2xl text-court-ink mb-3">About the court</h2>
              <p className="text-court-ink/75 leading-relaxed">
                Court of Apil is an exclusive outdoor pickleball court located in Talisay City, Cebu. The
                facility is open 24/7 and offers paddle and ball rentals, with free parking available for
                players.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-court-ink/75">
                <li className="flex gap-2"><span className="text-court-orange">●</span> Outdoor court, open every day, all day</li>
                <li className="flex gap-2"><span className="text-court-orange">●</span> Paddle &amp; ball rental available on-site</li>
                <li className="flex gap-2"><span className="text-court-orange">●</span> Free parking for all players</li>
                <li className="flex gap-2"><span className="text-court-orange">●</span> Located in Talisay City, Cebu</li>
              </ul>
            </div>
            <div>
              <h3 className="font-display font-600 text-lg text-court-ink mb-3">Location</h3>
              <MapToggle />
            </div>
          </div>
        </section>

        {/* RENTALS */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="font-display font-700 text-2xl text-court-ink mb-6">Paddle &amp; ball rentals</h2>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
            <div className="rounded-court border-2 border-court-blue-dark/20 bg-white p-6 shadow-court">
              <PaddleIcon className="h-8 w-8 text-court-blue-dark mb-3" />
              <p className="font-display font-600 text-lg text-court-ink">1 Paddle</p>
              <p className="text-sm text-court-ink/60 mb-2">Includes 2 balls</p>
              <p className="font-display font-700 text-2xl text-court-orange">₱100</p>
            </div>
            <div className="rounded-court border-2 border-court-orange/30 bg-court-orange/5 p-6 shadow-court">
              <div className="flex -space-x-2 mb-3">
                <PaddleIcon className="h-8 w-8 text-court-orange" />
                <PaddleIcon className="h-8 w-8 text-court-orange-dark" />
              </div>
              <p className="font-display font-600 text-lg text-court-ink">2 Paddles</p>
              <p className="text-sm text-court-ink/60 mb-2">Includes 3 balls</p>
              <p className="font-display font-700 text-2xl text-court-orange">₱150</p>
            </div>
          </div>
          <p className="text-xs text-court-ink/50 mt-3">Rentals are added directly to your booking total at checkout.</p>
        </section>

        {/* PRICING */}
        <section id="pricing" className="bg-court-ink text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="font-display font-700 text-2xl mb-6">Court rates</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="rounded-court bg-white/5 border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-court-blue font-bold mb-2">Weekdays</p>
                <p className="text-lg font-display font-600">Mon–Fri, 6:00 AM – 5:00 PM</p>
                <p className="text-3xl font-display font-700 text-court-blue mt-2">₱200<span className="text-sm font-body text-white/50">/hour</span></p>
              </div>
              <div className="rounded-court bg-white/5 border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-court-orange-light font-bold mb-2">Nights &amp; weekends</p>
                <p className="text-lg font-display font-600">Mon–Fri 5PM–6AM, and all day Sat–Sun</p>
                <p className="text-3xl font-display font-700 text-court-orange-light mt-2">₱250<span className="text-sm font-body text-white/50">/hour</span></p>
              </div>
            </div>
          </div>
        </section>

        {/* SCHEDULE PREVIEW */}
        <section id="schedule" className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <h2 className="font-display font-700 text-2xl text-court-ink">Today&apos;s schedule</h2>
            <Link href="/book" className="focus-ring text-sm font-semibold text-court-orange-dark hover:underline">
              Book a slot →
            </Link>
          </div>
          <HomeScheduleSection />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
