// Home Page - Neo-Brutalism meets Luxury Retail
// Design Philosophy: Bold typography, stark contrasts, electric blue accents, asymmetric layouts

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { products as staticCatalog, type Product } from "@/lib/products";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Curated DB highlights first; then bundled static items not already in that list.
 * When the API returns no rows, falls back to static only.
 */
function mergeDbHighlightsWithStaticFallback(
  staticList: Product[],
  dbList: Product[] | undefined,
  max: number
): Product[] {
  const db = dbList ?? [];
  if (db.length === 0) return staticList.slice(0, max);
  const dbIds = new Set(db.map(p => p.id));
  const staticExtras = staticList.filter(p => !dbIds.has(p.id));
  return [...db, ...staticExtras].slice(0, max);
}

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const staticHighlights = useMemo(
    () => ({
      trending: staticCatalog.filter(p => p.trending),
      featured: staticCatalog.filter(p => p.featured),
    }),
    []
  );

  const highlights = trpc.store.listHomeHighlights.useQuery(undefined, {
    staleTime: 60_000,
    placeholderData: staticHighlights,
  });

  const trendingProducts = useMemo(
    () => mergeDbHighlightsWithStaticFallback(staticHighlights.trending, highlights.data?.trending, 24),
    [staticHighlights.trending, highlights.data?.trending]
  );

  const featuredProducts = useMemo(
    () => mergeDbHighlightsWithStaticFallback(staticHighlights.featured, highlights.data?.featured, 24),
    [staticHighlights.featured, highlights.data?.featured]
  );

  // Set page title for SEO (30-60 characters)
  useEffect(() => {
    document.title = "The Hookah Shop - Premium Shisha & Vapes";
  }, []);

  const heroSlides = [
    {
      title: "PREMIUM TOBACCO",
      subtitle: "NOW AVAILABLE",
      description: "Experience bold new flavors crafted for enthusiasts",
      cta: "SHOP NOW",
      link: "/collections/shisha",
      bg: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)"
    },
    {
      title: "LUXURY HOOKAHS",
      subtitle: "NEW COLLECTION",
      description: "Discover our curated selection of premium pieces",
      cta: "EXPLORE",
      link: "/collections/hookahs",
      bg: "linear-gradient(135deg, #0A0A0A 0%, #1F2937 100%)"
    },
    {
      title: "SNOOP DOGG COLLECTION",
      subtitle: "EXCLUSIVE FLAVORS",
      description: "Limited edition Al Fakher collaboration - 5 unique blends",
      cta: "GET YOURS",
      link: "/shisha/al-fakher",
      bg: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)"
    },
    {
      title: "WHOLESALE DEALS",
      subtitle: "BULK PRICING",
      description: "Stock up and save big on RoR Tobacco 1kg - 41 flavors",
      cta: "VIEW DEALS",
      link: "/wholesale",
      bg: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
    },
    {
      title: "STARBUZZ MINI",
      subtitle: "PORTABLE LUXURY",
      description: "Complete hookah sets in 9 stunning colors - Perfect for travel",
      cta: "SHOP COLORS",
      link: "/hookahs",
      bg: "linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)"
    }
  ];

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);

  // Auto-cycle slides every 7 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 7000);

    return () => clearInterval(interval);
  }, [currentSlide]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Slider */}
        <section className="relative h-[600px] overflow-hidden">
          {heroSlides.map((slide, index) => (
            <Link
              key={index}
              href={slide.link}
              className={`absolute inset-0 transition-opacity duration-500 cursor-pointer ${
                index === currentSlide ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
              }`}
              style={{ background: slide.bg }}
            >
              <div className="container h-full flex items-center">
                <div className="max-w-2xl text-white transition-transform duration-300 hover:scale-105">
                  <p className="text-sm font-bold mb-2 tracking-widest">{slide.subtitle}</p>
                  <h1 className="text-7xl font-display font-black mb-6 leading-none" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.08), 0 0 15px rgba(255, 255, 255, 0.05)' }}>
                    {slide.title}
                  </h1>
                  <p className="text-xl mb-8 font-medium">{slide.description}</p>
                  <span className="inline-block bg-white text-foreground hover:bg-secondary brutalist-border brutalist-shadow hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-150 font-bold text-lg px-8 py-3">
                    {slide.cta}
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* Slider Controls — mobile: hug outer edges + slightly smaller controls; md+: same offset/size as before */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous slide"
            className="absolute z-20 top-1/2 -translate-y-1/2 flex size-11 min-h-11 min-w-11 items-center justify-center bg-white brutalist-border transition-colors duration-150 hover:bg-primary hover:text-white max-md:left-[max(0.25rem,env(safe-area-inset-left,0px))] md:left-4 md:size-12 md:min-h-12 md:min-w-12"
          >
            <ChevronLeft className="h-5 w-5 shrink-0 md:h-6 md:w-6" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next slide"
            className="absolute z-20 top-1/2 -translate-y-1/2 flex size-11 min-h-11 min-w-11 items-center justify-center bg-white brutalist-border transition-colors duration-150 hover:bg-primary hover:text-white max-md:right-[max(0.25rem,env(safe-area-inset-right,0px))] md:right-4 md:size-12 md:min-h-12 md:min-w-12"
          >
            <ChevronRight className="h-5 w-5 shrink-0 md:h-6 md:w-6" />
          </button>

          {/* Slide Indicators */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 border-2 border-white transition-colors duration-150 ${
                  index === currentSlide ? "bg-white" : "bg-transparent"
                }`}
              />
            ))}
          </div>
        </section>

        {/* Trending Products Carousel */}
        <section className="py-16 bg-secondary border-y-3 border-border">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl font-display font-black">TRENDING</h2>
            </div>
            
            <div className="overflow-x-auto pb-4 -mx-4 px-4">
              <div className="flex gap-6" style={{ width: 'max-content' }}>
                {trendingProducts.map((product, i) => (
                  <div key={product.id} className="w-64 flex-shrink-0">
                    <ProductCard
                      product={product}
                      imageFetchPriority={i === 0 ? "high" : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* New Arrivals Grid */}
        <section className="py-16">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl font-display font-black">NEW ARRIVALS</h2>
              <Link href="/collections/all" className="text-primary hover:underline font-bold">
                Show All →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>


      </main>

      <Footer />
    </div>
  );
}
