import Header from "@/components/Header";
import { THS_LOGO_MARK_SRC } from "@/lib/thsBrandAssets";
import Footer from "@/components/Footer";

export default function AgeVerification() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-5xl font-display font-black mb-4 text-center">AGE VERIFICATION</h1>
          <div className="flex justify-center mb-8">
            <img
              src={THS_LOGO_MARK_SRC}
              alt="The Hookah Shop"
              className="w-32 max-w-[8rem] h-auto object-contain select-none"
              width={128}
              height={128}
            />
          </div>
          <div className="brutalist-border bg-secondary p-12 text-left space-y-6">
            <p className="text-2xl font-display font-black">21+ only</p>
            <p className="leading-relaxed">
              The Hookah Shop is an adult use retailer. Customers must be{" "}
              <strong>21 years of age or older</strong> to purchase age-restricted products,
              including tobacco, shisha, and related goods sold on this site.
            </p>
            <p className="leading-relaxed">
              <strong>Age checks may occur</strong> when you create an account, at checkout, after
              your order is placed, or before delivery — including requests for adult signature or
              identification at the door where carriers or law require it.
            </p>
            <p className="leading-relaxed">
              Orders may be <strong>held, canceled, or refunded</strong> if we cannot complete
              verification to our satisfaction. We may request government-issued photo identification
              and reserve the right to refuse service when verification fails or appears inconsistent.
            </p>
            <p className="leading-relaxed">
              <strong>Misrepresenting your age is prohibited.</strong> Attempts to bypass age
              verification — including use of another person&apos;s identity, forged documents, or
              fraudulent shipping arrangements — may result in <strong>immediate account closure</strong>
              , canceled orders, and cooperation with law enforcement or payment networks as
              appropriate.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By shopping with The Hookah Shop, you confirm that you meet the legal age to purchase these
              products where you live and that you will comply with every verification step we or our
              partners require.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
