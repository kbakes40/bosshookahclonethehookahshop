import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Military() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-5xl font-display font-black mb-6">MILITARY DISCOUNT</h1>
          <div className="brutalist-border bg-secondary p-12">
            <p className="text-lg font-display font-black mb-4">Thank you for your service</p>
            <p className="mb-6 text-left leading-relaxed">
              The Hookah Shop is proud to support active duty service members, veterans, and
              military families. Eligibility and <strong>military verification may be required</strong>{" "}
              before a discount is applied — please have acceptable ID or verification materials ready
              when asked.
            </p>
            <p className="mb-6 text-left leading-relaxed">
              <strong>Discount terms, percentages, and eligible product categories may change without
                notice</strong> and may not combine with other promotions. Age and shipping rules for
              regulated products still apply in full.
            </p>
            <p className="text-sm text-muted-foreground">
              For current military offers and how to verify in-store or over the phone, call{" "}
              <a href="tel:+13134066589" className="text-primary font-semibold hover:underline">
                (313) 406-6589
              </a>{" "}
              or visit us at 6520 Greenfield Rd, Dearborn, MI 48126.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
