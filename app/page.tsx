import HowItWorks from "@/components/how-it-works";
import Hero from "@/components/hero";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
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
