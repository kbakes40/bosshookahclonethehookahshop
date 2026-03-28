import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";

export default function Returns() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-black mb-8 text-center">
            RETURN POLICY
          </h1>

          <div className="brutalist-border bg-secondary p-8 md:p-12 space-y-6 prose prose-lg max-w-none">
            <p className="text-lg font-semibold leading-relaxed">
              All sales are final. The Hookah Shop operates a strict no-return policy on
              age-restricted and consumable inventory. By completing a purchase, you acknowledge and
              accept this policy in full.
            </p>

            <section className="space-y-3">
              <h2 className="text-xl font-display font-black">Non-returnable & non-exchangeable items</h2>
              <p className="leading-relaxed">
                We do not accept returns, exchanges, or refunds for tobacco, shisha, charcoal,
                e-liquids, disposable products, opened products, used products, clearance items, or
                gift cards — including items purchased as gifts. This list is not exhaustive; similar
                regulated or consumable goods are treated the same unless a narrow exception below
                applies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-display font-black">
                Exceptions — wrong item or carrier damage only
              </h2>
              <p className="leading-relaxed">
                The only exceptions we consider are if you received the wrong item or your order
                arrived damaged in transit. These claims are reviewed case by case and are not
                guaranteed.
              </p>
              <ul className="list-disc pl-6 space-y-2 leading-relaxed">
                <li>
                  You must contact us within <strong>48 hours of delivery</strong> using the phone
                  number on our{" "}
                  <Link href="/contact" className="text-primary font-semibold hover:underline">
                    Contact
                  </Link>{" "}
                  page, with your <strong>order number</strong> ready.
                </li>
                <li>
                  You must provide <strong>clear photos</strong> of the outer packaging, any damage
                  to the box, and the product itself exactly as received. Omitting or delaying this
                  documentation may result in denial of the claim.
                </li>
                <li>
                  Approved resolutions — including replacement, store credit, or refund — are
                  offered solely at <strong>The Hookah Shop&apos;s discretion</strong> and depend on
                  inventory, compliance, and verification. We may request additional proof before
                  approving any resolution.
                </li>
              </ul>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Failure to follow these steps, or attempts to return items that are not eligible,
                will result in denial without exception.
              </p>
            </section>

            <section className="space-y-3 border-t-3 border-border pt-6">
              <p className="leading-relaxed">
                Questions about this policy? Call us at{" "}
                <a href="tel:+13134066589" className="text-primary font-semibold hover:underline">
                  (313) 406-6589
                </a>{" "}
                or visit our store at 6520 Greenfield Rd, Dearborn, MI 48126.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
