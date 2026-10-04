import HowItWorks from "@/components/how-it-works";
import Hero from "@/components/hero";
import SiteFooter from "@/components/site-footer";

export default function Home() {
  return (
    <>
      <main id="main" className="flex-1">
        <Hero />
        <div className="bs-shell">
          <div className="h-px bg-linear-to-r from-transparent via-white/12 to-transparent" />
        </div>
        <HowItWorks />
      </main>
      <SiteFooter />
    </>
  );
}
