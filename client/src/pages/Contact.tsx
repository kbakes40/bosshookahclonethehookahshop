import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Contact() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-5xl font-display font-black mb-6 text-center">CONTACT US</h1>
          <div className="brutalist-border bg-secondary p-12 space-y-8 text-left">
            <p className="text-lg leading-relaxed">
              Have a question about an order, a product, or a wholesale inquiry? Reach out — our team
              is here to help. The Hookah Shop serves enthusiasts and retailers with the same
              care we bring to our Dearborn showroom floor.
            </p>

            <div>
              <h2 className="font-display font-black text-xl mb-4">Contact Information</h2>
              <div className="space-y-3 text-base">
                <p>
                  <span className="font-bold">Phone:</span>{" "}
                  <a href="tel:+13134066589" className="text-primary hover:underline">
                    (313) 406-6589
                  </a>
                </p>
                <p>
                  <span className="font-bold">Address:</span> 6520 Greenfield Rd, Dearborn, MI 48126
                </p>
                <p>
                  <span className="font-bold">Hours:</span> Open daily — closes 1:00 AM
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              For order updates, age verification, or compliance-related questions, including the order
              number in your message helps us respond faster. We aim to get back to every inquiry as
              promptly as we can.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
