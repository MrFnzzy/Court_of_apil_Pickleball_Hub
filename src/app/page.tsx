import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MapToggle from "@/components/MapToggle";
import HomeScheduleSection from "@/components/HomeScheduleSection";
import HeroSlideshow from "@/components/HeroSlideshow";
import BallIcon from "@/components/icons/BallIcon";
import PaddleIcon from "@/components/icons/PaddleIcon";
import { prisma } from "@/lib/prisma";
import { getSiteSettings, parseBullets } from "@/lib/siteSettings";
import { getPricingSettings } from "@/lib/pricingSettings";
import { rentalPackages } from "@/lib/pricing";

// See layout.tsx for why this is needed: without it, admin edits to pricing
// and content wouldn't appear on the live site until the next redeploy.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, slides, pricing] = await Promise.all([
    getSiteSettings(),
    prisma.heroSlide.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    getPricingSettings(),
  ]);

  const bullets = parseBullets(settings.aboutBullets);
  const packages = rentalPackages(pricing);

  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-court-blue-light/60 text-court-blue-dark px-3 py-1 text-xs font-bold uppercase tracking-widest">
                <BallIcon className="h-3.5 w-3.5" /> {settings.heroBadgeText}
              </span>
              <h1 className="font-display font-700 text-4xl sm:text-5xl leading-[1.05] mt-5 text-court-ink">
                {settings.heroHeadlineLine1}
                <span className="block text-court-orange">{settings.heroHeadlineLine2}</span>
              </h1>
              <p className="mt-5 text-lg text-court-ink/75 max-w-xl">{settings.heroSubtext}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/book"
                  className="focus-ring inline-flex items-center gap-2 rounded-full bg-court-orange text-white px-6 py-3.5 font-semibold shadow-court-lg hover:bg-court-orange-dark transition-colors"
                >
                  <PaddleIcon className="h-5 w-5" /> {settings.heroPrimaryButtonText}
                </Link>
                <a
                  href="#pricing"
                  className="focus-ring inline-flex items-center gap-2 rounded-full border-2 border-court-ink/15 px-6 py-3.5 font-semibold text-court-ink hover:border-court-orange/60 transition-colors"
                >
                  {settings.heroSecondaryButtonText}
                </a>
              </div>
            </div>

            <HeroSlideshow
              slides={slides.map((s) => ({
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

        {/* ABOUT + MAP */}
        <section className="bg-white border-y-2 border-court-orange/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid md:grid-cols-2 gap-10 items-start">
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
        </section>

        {/* RENTALS */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="font-display font-700 text-2xl text-court-ink mb-6">Paddle &amp; ball rentals</h2>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
            <div className="rounded-court border-2 border-court-blue-dark/20 bg-white p-6 shadow-court">
              <PaddleIcon className="h-8 w-8 text-court-blue-dark mb-3" />
              <p className="font-display font-600 text-lg text-court-ink">1 Paddle</p>
              <p className="text-sm text-court-ink/60 mb-2">Includes {packages[1].balls} balls</p>
              <p className="font-display font-700 text-2xl text-court-orange">₱{packages[1].price}</p>
            </div>
            <div className="rounded-court border-2 border-court-orange/30 bg-court-orange/5 p-6 shadow-court">
              <div className="flex -space-x-2 mb-3">
                <PaddleIcon className="h-8 w-8 text-court-orange" />
                <PaddleIcon className="h-8 w-8 text-court-orange-dark" />
              </div>
              <p className="font-display font-600 text-lg text-court-ink">2 Paddles</p>
              <p className="text-sm text-court-ink/60 mb-2">Includes {packages[2].balls} balls</p>
              <p className="font-display font-700 text-2xl text-court-orange">₱{packages[2].price}</p>
            </div>
          </div>
          <p className="text-xs text-court-ink/50 mt-3">Rentals are added directly to your booking total at checkout.</p>
        </section>

        {/* PRICING */}
        <section id="pricing" className="bg-court-ink text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="font-display font-700 text-2xl mb-6">Court rates</h2>
            <div className="grid sm:grid-cols-3 gap-5">
              <div className="rounded-court bg-white/5 border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-court-blue font-bold mb-2">Weekday day</p>
                <p className="text-lg font-display font-600">Mon–Fri, 6:00 AM – 4:59 PM</p>
                <p className="text-3xl font-display font-700 text-court-blue mt-2">₱{pricing.weekdayDayPrice}<span className="text-sm font-body text-white/50">/hour</span></p>
              </div>
              <div className="rounded-court bg-white/5 border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-court-orange-light font-bold mb-2">Weekday night</p>
                <p className="text-lg font-display font-600">Mon–Fri, 5:00 PM – 5:59 AM</p>
                <p className="text-3xl font-display font-700 text-court-orange-light mt-2">₱{pricing.weekdayNightPrice}<span className="text-sm font-body text-white/50">/hour</span></p>
              </div>
              <div className="rounded-court bg-white/5 border border-white/10 p-6">
                <p className="text-xs uppercase tracking-widest text-white font-bold mb-2">Weekends</p>
                <p className="text-lg font-display font-600">Sat &amp; Sun, all day</p>
                <p className="text-3xl font-display font-700 text-white mt-2">₱{pricing.weekendPrice}<span className="text-sm font-body text-white/50">/hour</span></p>
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
