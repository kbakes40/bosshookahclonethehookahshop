import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-display font-black mb-8 text-center md:text-left">
            TERMS &amp; CONDITIONS
          </h1>

          <div className="prose prose-lg max-w-none space-y-8">
            <p className="text-lg leading-relaxed">
              These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of
              bosshookah.site and any purchases you make through The Hookah Shop
              (&quot;The Hookah Shop,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By
              using the site or placing an order, you agree to these Terms. If you do not agree, do
              not use the site or purchase from us.
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Website use</h2>
              <p className="leading-relaxed">
                We grant you a limited, revocable license to access and use the site for personal,
                non-commercial shopping in accordance with these Terms. We may modify, suspend, or
                discontinue any part of the site at any time. The site may contain links to
                third-party sites; we are not responsible for their content or policies. You agree
                not to misuse the site, interfere with its operation, scrape or harvest data without
                permission, or use it for unlawful purposes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Eligibility &amp; age requirement</h2>
              <p className="leading-relaxed">
                The Hookah Shop is an adult-oriented retailer. You must be at least{" "}
                <strong>21 years of age</strong> to purchase age-restricted products. By creating an
                account, using the site, or placing an order, you represent and warrant that you are
                at least 21 and that you are legally permitted to purchase, possess, and receive the
                products in your jurisdiction. You further represent that all information you
                provide is accurate and that you will not purchase on behalf of a minor or for
                unlawful resale where prohibited. Additional age verification requirements are
                described on our{" "}
                <Link href="/age-verification" className="text-primary font-semibold hover:underline">
                  Age Verification
                </Link>{" "}
                page and may apply before, during, or after checkout.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Account responsibility</h2>
              <p className="leading-relaxed">
                If you create an account, you are responsible for safeguarding your credentials and
                for all activity under your account. Notify us promptly of any unauthorized use. We
                may suspend or close accounts that violate these Terms, fail verification, or
                present fraud or compliance risk.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Product information &amp; availability</h2>
              <p className="leading-relaxed">
                We strive for accurate descriptions, images, and specifications, but occasional
                errors may occur. Products are offered subject to availability.{" "}
                <strong>
                  Product availability, pricing, promotions, and packaging may change without
                  notice.
                </strong>{" "}
                We reserve the right to limit quantities, discontinue items, or correct pricing and
                description errors before or after an order is placed. If we cannot fulfill an order
                as priced or described, we may cancel it and refund any amount collected, or offer an
                alternative at our discretion.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Pricing &amp; payment</h2>
              <p className="leading-relaxed">
                All prices are in U.S. dollars unless stated otherwise. Taxes and shipping, where
                applicable, are additional and shown before you complete checkout. You authorize us
                and our payment partners to charge your selected payment method for the total
                purchase amount. We may use verification and fraud-prevention measures; failed
                verification or payment may result in delay or cancellation. Chargebacks and
                disputed payments are addressed below.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Orders, acceptance &amp; cancellation</h2>
              <p className="leading-relaxed">
                Submitting an order is an offer to purchase. We may refuse or cancel any order, in
                whole or in part, at any time before fulfillment, including for suspected fraud,
                payment issues, inventory errors, failure to meet age or identity verification,
                compliance concerns, or inability to ship to your location. Receipt of an order
                acknowledgment does not guarantee acceptance. A contract is formed when we charge
                your payment or ship your order, as applicable under our processes.
              </p>
              <p className="leading-relaxed">
                <strong>
                  The Hookah Shop may cancel or refuse any order that cannot be verified, appears
                  fraudulent, or cannot legally be shipped to the customer&apos;s location.
                </strong>{" "}
                If we cancel after payment, we will refund applicable amounts unless law or
                investigation requires otherwise.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Shipping &amp; compliance</h2>
              <p className="leading-relaxed">
                We <strong>do not ship products where prohibited by law</strong> and reserve the
                right to limit or refuse shipments based on state or local rules, carrier
                restrictions, or compliance requirements. You are responsible for providing a
                complete, accurate delivery address and for being available when signature or
                adult-receipt is required.
              </p>
              <p className="leading-relaxed">
                <strong>
                  The Hookah Shop is not responsible for orders that are delayed, denied, returned,
                  refused by the carrier, or seized by authorities due to local restrictions, failed
                  age verification, incorrect addresses, recipient unavailability, or carrier or
                  customs handling.
                </strong>{" "}
                Risk of loss passes in accordance with our carrier terms and applicable law once
                the shipment is tendered to the carrier, except where a narrow claim applies as
                described in our Return Policy.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Returns &amp; refunds</h2>
              <p className="leading-relaxed">
                All sales are subject to our strict return policy. Please review our{" "}
                <Link href="/returns" className="text-primary font-semibold hover:underline">
                  Return Policy
                </Link>{" "}
                in full. Except as stated there for wrong-item or transit-damage claims submitted
                within the required timeframe with documentation,{" "}
                <strong>all sales are final</strong> and we do not accept returns, exchanges, or
                refunds on the categories listed in that policy.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Chargebacks &amp; fraud prevention</h2>
              <p className="leading-relaxed">
                If you dispute a charge with your bank or card issuer without first contacting us to
                resolve a legitimate issue, we may suspend your account, refuse future orders, and
                pursue available remedies. False claims, stolen payment methods, or collusion to
                circumvent age or shipping rules may be reported to law enforcement and payment
                networks. We cooperate with investigations as required by law.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Intellectual property</h2>
              <p className="leading-relaxed">
                All content on the site — including text, graphics, logos, images, and software — is
                owned by The Hookah Shop or its licensors and is protected by copyright, trademark, and
                other laws. You may not copy, modify, distribute, or create derivative works without
                our prior written consent. Product and brand names of third parties are used for
                identification only and do not imply endorsement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Limitation of liability</h2>
              <p className="leading-relaxed">
                To the fullest extent permitted by applicable law, The Hookah Shop and its officers,
                directors, employees, and agents shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages, or for lost profits, data, or goodwill,
                arising from your use of the site or purchase of products, whether based in contract,
                tort, strict liability, or otherwise, even if advised of the possibility of such
                damages. Our total liability for any claim arising out of or relating to the site or
                your order shall not exceed the amount you paid for the specific products giving
                rise to the claim in the twelve (12) months preceding the claim. Some jurisdictions
                do not allow certain limitations; in those jurisdictions our liability is limited to
                the maximum permitted by law. Nothing in these Terms limits liability that cannot
                legally be limited, including for gross negligence or willful misconduct where
                applicable.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Indemnification</h2>
              <p className="leading-relaxed">
                You agree to indemnify, defend, and hold harmless The Hookah Shop and its affiliates,
                and their respective directors, officers, employees, and agents, from and against
                any claims, damages, losses, liabilities, and expenses (including reasonable
                attorneys&apos; fees) arising out of your use of the site, your breach of these
                Terms, your violation of law, or your misuse of any product.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Governing law &amp; disputes</h2>
              <p className="leading-relaxed">
                These Terms are governed by the laws of the State of Michigan, without regard to
                conflict-of-law principles, except where preempted by federal law. You agree that
                state or federal courts located in Wayne County, Michigan shall have exclusive
                jurisdiction over disputes arising from these Terms or your use of the site, subject
                to mandatory consumer protections in your home jurisdiction where they cannot
                lawfully be waived.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Changes to these Terms</h2>
              <p className="leading-relaxed">
                We may update these Terms at any time. The &quot;Last updated&quot; date at the
                bottom of this page will change when we do. Continued use of the site after changes
                constitutes acceptance of the revised Terms. If you do not agree, you must stop
                using the site. Material changes may, where required, be communicated through the
                site or by email.
              </p>
            </section>

            <section className="space-y-4 brutalist-border bg-secondary p-8">
              <h2 className="text-2xl font-display font-black">Privacy &amp; data practices</h2>
              <p className="leading-relaxed text-base">
                This section summarizes how we handle personal information in connection with the
                site and orders. It is part of these Terms.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Information we collect</h3>
              <p className="leading-relaxed text-base">
                We may collect identifiers and contact details (such as name, email, phone, and
                shipping address), order history, device and browser data, communications logs, and
                verification-related information when you shop, create an account, or contact
                support.
              </p>
              <h3 className="text-xl font-display font-black mt-4">How we use information</h3>
              <p className="leading-relaxed text-base">
                We use this information to process and fulfill orders, verify age and identity,
                prevent fraud, communicate about your transactions, improve the site, comply with
                law, and enforce these Terms.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Payment &amp; fraud prevention</h3>
              <p className="leading-relaxed text-base">
                Payment details are processed by secure service providers. We do not store full
                payment credentials on our servers. We may share limited transaction data with
                processors and fraud-screening tools as needed to complete and protect transactions.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Account data</h3>
              <p className="leading-relaxed text-base">
                Account information is used to personalize your experience, save preferences where
                available, and link orders to your profile when you sign in.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Email &amp; SMS</h3>
              <p className="leading-relaxed text-base">
                We may send transactional messages related to orders and verification. Where
                permitted, we may send marketing email or SMS; you may opt out of marketing
                communications using the instructions in those messages or by contacting us,
                subject to transactional notices we must send.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Cookies &amp; analytics</h3>
              <p className="leading-relaxed text-base">
                We use cookies and similar technologies to operate the site, remember preferences,
                and understand aggregate traffic and performance. You can control cookies through
                browser settings; disabling them may limit certain features.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Service providers &amp; sharing</h3>
              <p className="leading-relaxed text-base">
                We share information with hosting, logistics, payment, verification, analytics, and
                communications vendors who process data on our behalf under contractual
                obligations. We may disclose information when required by law or to protect our
                rights, customers, or the public.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Legal compliance &amp; rights</h3>
              <p className="leading-relaxed text-base">
                Depending on where you live, you may have rights to access, correct, delete, or
                restrict certain personal data, or to object to processing. To exercise applicable
                rights, contact us using the information below. We will respond in accordance with
                applicable law.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Retention</h3>
              <p className="leading-relaxed text-base">
                We retain information as long as necessary for the purposes above, including order
                records, tax and accounting obligations, fraud prevention, and dispute resolution,
                then delete or anonymize it where feasible.
              </p>
              <h3 className="text-xl font-display font-black mt-4">Contact (privacy)</h3>
              <p className="leading-relaxed text-base">
                For privacy questions or requests, email{" "}
                <a href="mailto:info@bosshookah.site" className="text-primary font-semibold hover:underline">
                  info@bosshookah.site
                </a>{" "}
                or call{" "}
                <a href="tel:+13134066589" className="text-primary font-semibold hover:underline">
                  (313) 406-6589
                </a>
                .
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Severability</h2>
              <p className="leading-relaxed">
                If any provision of these Terms is held invalid or unenforceable, the remaining
                provisions remain in full effect, and the invalid provision shall be modified to the
                minimum extent necessary to make it enforceable.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-black">Contact us</h2>
              <div className="bg-secondary brutalist-border p-6 not-prose">
                <p className="mb-2">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:info@bosshookah.site" className="text-primary font-semibold hover:underline">
                    info@bosshookah.site
                  </a>
                </p>
                <p className="mb-2">
                  <strong>Phone:</strong>{" "}
                  <a href="tel:+13134066589" className="text-primary font-semibold hover:underline">
                    (313) 406-6589
                  </a>
                </p>
                <p className="mb-2">
                  <strong>Address:</strong>
                </p>
                <p>The Hookah Shop</p>
                <p>6520 Greenfield Rd</p>
                <p>Dearborn, MI 48126</p>
              </div>
              <p className="leading-relaxed">
                We aim to respond to substantive inquiries within a reasonable time. For order-specific
                issues, include your order number.
              </p>
            </section>

            <section className="border-t-3 border-border pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                <strong>Last updated:</strong> March 25, 2026
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                By using bosshookah.site, you acknowledge that you have read and understood these
                Terms and our privacy practices described above.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
