import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-5xl font-display font-black mb-6 text-center">ABOUT US</h1>
          <div className="brutalist-border bg-secondary p-12 text-left space-y-8">
            <div className="space-y-3">
              <h2 className="text-xl font-display font-black">Who we are</h2>
              <p className="leading-relaxed">
                The Hookah Shop is a Dearborn-rooted retailer built for people who take their
                sessions seriously. From the neighborhood regular to the buyer stocking a lounge or
                shop, we speak the language of quality bowls, clean draws, and gear that lasts —
                because we live it every day on the showroom floor until 1:00 AM.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-display font-black">What we sell</h2>
              <p className="leading-relaxed">
                We curate premium hookahs, shisha tobacco, charcoals, accessories, and adjacent
                categories our customers ask for — from entry-level setups to enthusiast-grade
                pieces and hard-to-find cuts. Every SKU earns its shelf space: authentic sourcing,
                proper storage, and honest merchandising are non-negotiable.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-display font-black">Why customers shop with us</h2>
              <p className="leading-relaxed">
                You get straight answers, fair pricing, and a team that actually uses what we sell.
                We respect the 21+ nature of this business, enforce verification without drama, and
                ship and fulfill with the same discipline we apply in-store. Whether you walk into{" "}
                <span className="font-semibold">6520 Greenfield Rd</span> or order online, expect a
                premium retail experience — not a drop-ship roulette.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-display font-black">Quality &amp; service</h2>
              <p className="leading-relaxed">
                We stand behind what we stock: careful intake, climate-aware handling where it
                matters, and responsive support when something goes wrong. Compliance, carrier rules,
                and Michigan retail standards aren&apos;t footnotes here — they&apos;re how we keep
                the lights on and your trust intact.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-display font-black">Wholesale</h2>
              <p className="leading-relaxed">
                Shops, lounges, and volume buyers: we support wholesale relationships with the same
                product knowledge we bring to counter sales. Reach out with your business details and
                needs — we&apos;ll walk you through availability, minimums, and verification so we
                can grow together responsibly.
              </p>
            </div>

            <p className="text-sm text-muted-foreground pt-2 border-t-3 border-border">
              <span className="font-semibold">Visit us:</span> Open daily, closes 1:00 AM ·{" "}
              <a href="tel:+13134066589" className="text-primary hover:underline">
                (313) 406-6589
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
