import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MapToggle from "@/components/MapToggle";
import HomeScheduleSection from "@/components/HomeScheduleSection";
import HeroSlideshow from "@/components/HeroSlideshow";
import PopupAdModal from "@/components/PopupAdModal";
import RentalProductGrid from "@/components/RentalProductGrid";
import FAQSection from "@/components/FAQSection";
import ReservationPreview from "@/components/ReservationPreview";
import Reveal from "@/components/Reveal";
import BallIcon from "@/components/icons/BallIcon";
import PaddleIcon from "@/components/icons/PaddleIcon";
import { prisma } from "@/lib/prisma";
import { getSiteSettings, parseBullets } from "@/lib/siteSettings";
import { getPricingSettings } from "@/lib/pricingSettings";
import { getActiveRentalProducts } from "@/lib/rentalProducts";
import { getPopupAd } from "@/lib/popupAd";

// See layout.tsx for why this is needed: without it, admin edits to pricing
// and content wouldn't appear on the live site until the next redeploy.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, slides, pricing, rentalProducts, popupAd] = await Promise.all([
    getSiteSettings(),
    prisma.heroSlide.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    getPricingSettings(),
    getActiveRentalProducts(),
    getPopupAd(),
  ]);

  const bullets = parseBullets(settings.aboutBullets);
  const paddleProducts = rentalProducts.filter((p) => p.type === "PADDLE");
  const ballProducts = rentalProducts.filter((p) => p.type === "BALL");

  return (
    <>
      <SiteHeader />
      {popupAd.enabled && popupAd.imageUrl && (
        <PopupAdModal
          ad={{
            imageUrl: popupAd.imageUrl,
            videoUrl: popupAd.videoUrl,
            headline: popupAd.headline,
            message: popupAd.message,
            linkUrl: popupAd.linkUrl,
            buttonText: popupAd.buttonText,
            version: popupAd.updatedAt.toISOString(),
          }}
        />
      )}
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="glass-orb glass-orb--blue h-72 w-72 sm:h-96 sm:w-96 -top-24 -left-24" />
          <div className="glass-orb glass-orb--orange h-64 w-64 sm:h-80 sm:w-80 top-10 right-0 sm:-right-16" />
          <div className="relative z-[1] max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 grid lg:grid-cols-2 gap-10 items-center">
            <div className="hero-copy">
              <span className="glass-chip inline-flex items-center gap-2 rounded-full text-court-blue-dark px-3 py-1.5 text-xs font-bold uppercase tracking-widest">
                <BallIcon className="h-3.5 w-3.5" /> {settings.heroBadgeText}
              </span>
              <h1 className="font-display font-700 text-4xl sm:text-5xl leading-[1.05] mt-5 text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
                {settings.heroHeadlineLine1}
                <span className="block text-court-orange-light">{settings.heroHeadlineLine2}</span>
              </h1>
              <p className="mt-5 text-lg text-white/80 max-w-xl">{settings.heroSubtext}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/book"
                  className="fx-magnetic glass-btn-primary focus-ring inline-flex items-center gap-2 rounded-full text-white px-6 py-3.5 font-semibold transition-shadow"
                >
                  <PaddleIcon className="h-5 w-5" /> {settings.heroPrimaryButtonText}
                </Link>
                <a
                  href="#pricing"
                  className="glass-btn-secondary focus-ring inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-semibold text-court-ink transition-colors"
                >
                  {settings.heroSecondaryButtonText}
                </a>
              </div>
            </div>

            <HeroSlideshow
              slides={slides.map((s: (typeof slides)[number]) => ({
                id: s.id,
                imageUrl: s.imageUrl,
                headline: s.headline,
                subtext: s.subtext,
                linkUrl: s.linkUrl,
              }))}
              cardTitle={settings.heroCardTitle}
              cardSubtitle={settings.heroCardSubtitle}
            />
          </div>
        </section>

        <div className="playbook-ticker" aria-label="Pickleball highlights">
          <div className="playbook-ticker__track">
            {["Open 20/7", "Court-ready gear", "Talisay City, Cebu", "Your next rally starts here", "Open 20/7", "Court-ready gear", "Talisay City, Cebu", "Your next rally starts here"].map((item, index) => <span className="playbook-ticker__item" key={`${item}-${index}`}><span className="playbook-ticker__dot" />{item}</span>)}
          </div>
        </div>

        <Reveal>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <ReservationPreview court360Url={settings.court360Url} />
        </section>
        </Reveal>

        {/* ABOUT + MAP */}
        <Reveal>
        <section className="relative py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="glass-panel rounded-court p-6 sm:p-10 grid md:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="font-display font-700 text-2xl text-court-ink mb-3">{settings.aboutHeading}</h2>
                <p className="text-court-ink/75 leading-relaxed">{settings.aboutText}</p>
                <ul className="mt-5 space-y-2 text-sm text-court-ink/75">
                  {bullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-court-orange">●</span> {bullet}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-display font-600 text-lg text-court-ink mb-3">Location</h3>
                <MapToggle />
              </div>
            </div>
          </div>
        </section>
        </Reveal>

        <Reveal>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="motion-grid">
            <div className="motion-grid__feature motion-grid__card fx-tilt glass-panel rounded-court p-6 sm:p-8 text-court-ink">
              <span className="text-xs font-bold uppercase tracking-[.22em] text-court-orange-dark">The rally rhythm</span>
              <h2 className="font-display font-700 text-3xl mt-3">Play more. Wait less.</h2>
              <p className="mt-3 text-court-ink/70 leading-relaxed">A bright, friendly court experience built around fast booking, quality gear, and the energy of your next game.</p>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-court-blue-dark"><span className="h-2 w-2 rounded-full bg-court-orange animate-pulse" />Ready when you are</div>
            </div>
            <div className="motion-grid__wide grid sm:grid-cols-3 gap-4">
              <div className="motion-grid__card fx-tilt glass-panel rounded-court p-5 text-court-ink"><p className="text-4xl font-display font-700 text-court-orange">20/7</p><p className="mt-2 text-sm font-semibold">Court access</p><p className="mt-1 text-xs text-court-ink/60">Book the time that fits your game.</p></div>
              <div className="motion-grid__card fx-tilt glass-panel rounded-court p-5 text-court-ink"><p className="text-4xl font-display font-700 text-court-blue-dark">1 tap</p><p className="mt-2 text-sm font-semibold">Easy booking</p><p className="mt-1 text-xs text-court-ink/60">Reserve a slot in minutes.</p></div>
              <div className="motion-grid__card fx-tilt glass-panel rounded-court p-5 text-court-ink"><p className="text-4xl font-display font-700 text-court-orange-dark">Cebu</p><p className="mt-2 text-sm font-semibold">Local energy</p><p className="mt-1 text-xs text-court-ink/60">A home court for the community.</p></div>
            </div>
          </div>
        </section>
        </Reveal>

        {/* PADDLE RENTALS */}
        <Reveal>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="font-display font-700 text-2xl text-white mb-6">Paddle rentals</h2>
          <RentalProductGrid products={paddleProducts} />
          <p className="text-xs text-white/60 mt-3">Rentals are added directly to your booking total at checkout.</p>
        </section>
        </Reveal>

        {/* BALL RENTALS */}
        <Reveal>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="font-display font-700 text-2xl text-white mb-6">Ball prices</h2>
          <RentalProductGrid products={ballProducts} />
        </section>
        </Reveal>

        {/* PRICING */}
        <Reveal>
        <section id="pricing" className="relative bg-court-ink text-white overflow-hidden">
          <div className="glass-orb glass-orb--blue h-80 w-80 -top-20 -right-20 opacity-70" />
          <div className="glass-orb glass-orb--orange h-64 w-64 bottom-0 -left-20 opacity-60" />
          <div className="relative z-[1] max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="font-display font-700 text-2xl mb-6">Court rates</h2>
            <div className="grid sm:grid-cols-3 gap-5">
              <div className="glass-panel-dark rounded-court p-6 transition-colors">
                <p className="text-xs uppercase tracking-widest text-court-blue font-bold mb-2">Weekday day</p>
                <p className="text-lg font-display font-600">Mon–Fri, 6:00 AM – 4:59 PM</p>
                <p className="text-3xl font-display font-700 text-court-blue mt-2">₱{pricing.weekdayDayPrice}<span className="text-sm font-body text-white/50">/hour</span></p>
              </div>
              <div className="glass-panel-dark rounded-court p-6 transition-colors">
                <p className="text-xs uppercase tracking-widest text-court-orange-light font-bold mb-2">Weekday night</p>
                <p className="text-lg font-display font-600">Mon–Fri, 5:00 PM – 5:59 AM</p>
                <p className="text-3xl font-display font-700 text-court-orange-light mt-2">₱{pricing.weekdayNightPrice}<span className="text-sm font-body text-white/50">/hour</span></p>
              </div>
              <div className="glass-panel-dark rounded-court p-6 transition-colors">
                <p className="text-xs uppercase tracking-widest text-white font-bold mb-2">Weekends</p>
                <p className="text-lg font-display font-600">Sat &amp; Sun, all day</p>
                <p className="text-3xl font-display font-700 text-white mt-2">₱{pricing.weekendPrice}<span className="text-sm font-body text-white/50">/hour</span></p>
              </div>
            </div>
          </div>
        </section>
        </Reveal>

        {/* SCHEDULE PREVIEW */}
        <Reveal>
        <section id="schedule" className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <h2 className="font-display font-700 text-2xl text-white">Today&apos;s schedule</h2>
            <Link href="/book" className="focus-ring text-sm font-semibold text-court-orange-light hover:underline">
              Book a slot →
            </Link>
          </div>
          <div className="glass-panel rounded-court p-4 sm:p-6">
            <HomeScheduleSection />
          </div>
        </section>
        </Reveal>

        {/* FAQ */}
        <Reveal>
        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
          <div className="text-center mb-8">
            <span className="glass-chip inline-flex items-center gap-2 rounded-full text-court-blue-dark px-3 py-1.5 text-xs font-bold uppercase tracking-widest mb-4">
              Got questions?
            </span>
            <h2 className="font-display font-700 text-2xl sm:text-3xl text-white">Frequently asked questions</h2>
            <p className="text-white/60 mt-2 text-sm max-w-md mx-auto">
              Tap a question to expand it. Still stuck? Message us on Facebook.
            </p>
          </div>
          <FAQSection />
        </section>
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
