// Age Verification Modal - Neo-Brutalism meets Luxury Retail
// Must appear immediately on site visit, blocks access if declined

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { THS_LOGO_MARK_SRC } from "@/lib/thsBrandAssets";

const STORAGE_KEY = "bh_age_verified";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isVerificationValid(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { verified?: boolean; timestamp?: number };
    if (parsed?.verified !== true || typeof parsed.timestamp !== "number") return false;
    return Date.now() - parsed.timestamp < THIRTY_DAYS_MS;
  } catch {
    return false;
  }
}

export default function AgeVerificationModal() {
  const [isVerified, setIsVerified] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [exitBlocked, setExitBlocked] = useState(false);

  useEffect(() => {
    if (isVerificationValid()) {
      setIsVerified(true);
      return;
    }
    setShowModal(true);
  }, []);

  const handleYes = useCallback(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ verified: true, timestamp: Date.now() })
    );
    setIsVerified(true);
    setShowModal(false);
  }, []);

  const handleExit = useCallback(() => {
    setExitBlocked(true);
    setShowModal(false);
  }, []);

  useEffect(() => {
    if (!exitBlocked) return;
    const t = window.setTimeout(() => {
      window.location.replace("https://www.google.com");
    }, 2500);
    return () => window.clearTimeout(t);
  }, [exitBlocked]);

  if (exitBlocked) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black p-6 text-center">
        <p className="font-display font-black text-xl text-white md:text-2xl max-w-md leading-relaxed">
          You must be 21 or older to visit this site.
        </p>
      </div>
    );
  }

  if (isVerified || !showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg">
        <div className="bg-background brutalist-border p-8">
          <h2 className="font-display font-black text-2xl mb-4 text-center">
            Age Verification
          </h2>

          <div className="flex justify-center mb-6">
            <img
              src={THS_LOGO_MARK_SRC}
              alt="The Hookah Shop"
              className="w-28 max-w-[7rem] h-auto object-contain select-none"
              width={112}
              height={112}
            />
          </div>

          <p className="mb-8 text-sm leading-relaxed text-center">
            You must be 21 or older to enter this site. By clicking YES you confirm you are of
            legal age to purchase tobacco products in your jurisdiction.
          </p>

          <div className="space-y-4">
            <Button
              onClick={handleYes}
              className="w-full brutalist-border bg-blue-600 text-white hover:bg-blue-700 font-bold text-lg py-6"
            >
              YES
            </Button>

            <Button
              onClick={handleExit}
              variant="outline"
              className="w-full brutalist-border bg-background hover:bg-secondary font-bold text-lg py-6"
            >
              Exit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
