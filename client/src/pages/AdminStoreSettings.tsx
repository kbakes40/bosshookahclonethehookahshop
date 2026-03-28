// Admin Store Settings — pickup + Zelle details
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPageStackClass } from "@/components/admin/adminFilterBarStyles";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Store, MapPin, Phone, Mail, Clock, FileText } from "lucide-react";

export default function AdminStoreSettings() {
  const [, setLocation] = useLocation();

  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [zelleEmail, setZelleEmail] = useState("");
  const [zellePhone, setZellePhone] = useState("");

  const { data: settings, isLoading, refetch } = trpc.admin.getStoreSettings.useQuery();

  const updateSettings = trpc.admin.updateStoreSettings.useMutation({
    onSuccess: () => {
      toast.success("Store settings updated");
      refetch();
    },
    onError: () => toast.error("Failed to update store settings"),
  });

  useEffect(() => {
    if (settings) {
      setStoreName(settings.storeName || "");
      setAddress(settings.address || "");
      setCity(settings.city || "");
      setState(settings.state || "");
      setZipCode(settings.zipCode || "");
      setPhone(settings.phone || "");
      setEmail(settings.email || "");
      setHours(settings.hours || "");
      setPickupInstructions(settings.pickupInstructions || "");
      setZelleEmail(settings.zelleEmail || "");
      setZellePhone(settings.zellePhone || "");
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({
      storeName,
      address,
      city,
      state,
      zipCode,
      phone,
      email,
      hours,
      pickupInstructions,
      zelleEmail,
      zellePhone,
    });
  };

  const field =
    "flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2 [&_svg]:text-zinc-500";
  const inputClass =
    "bg-zinc-900/80 border-zinc-700 text-zinc-100 placeholder:text-zinc-600";

  return (
    <AdminShell title="Settings" subtitle="Store profile, pickup, and Zelle">
      <div className={`w-full max-w-3xl mx-auto ${adminPageStackClass}`}>
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">Loading settings…</div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800/90 bg-[#121214] overflow-hidden">
            <div className="p-6 space-y-5">
              <div>
                <label className={field}>
                  <Store className="w-4 h-4" />
                  Store name
                </label>
                <Input
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={field}>
                  <MapPin className="w-4 h-4" />
                  Street address
                </label>
                <Input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} required />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">City</label>
                  <Input value={city} onChange={e => setCity(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">State</label>
                  <Input
                    value={state}
                    onChange={e => setState(e.target.value.toUpperCase())}
                    className={inputClass}
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">ZIP</label>
                  <Input value={zipCode} onChange={e => setZipCode(e.target.value)} className={inputClass} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={field}>
                    <Phone className="w-4 h-4" />
                    Phone
                  </label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className={field}>
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={field}>
                  <Clock className="w-4 h-4" />
                  Store hours
                </label>
                <Textarea value={hours} onChange={e => setHours(e.target.value)} className={inputClass} rows={5} required />
              </div>

              <div>
                <label className={field}>
                  <FileText className="w-4 h-4" />
                  Pickup instructions
                </label>
                <Textarea
                  value={pickupInstructions}
                  onChange={e => setPickupInstructions(e.target.value)}
                  className={inputClass}
                  rows={4}
                  required
                />
              </div>

              <div className="border-t border-zinc-800/90 pt-5 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-200">Zelle</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={field}>
                      <Mail className="w-4 h-4" />
                      Zelle email
                    </label>
                    <Input type="email" value={zelleEmail} onChange={e => setZelleEmail(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={field}>
                      <Phone className="w-4 h-4" />
                      Zelle phone
                    </label>
                    <Input
                      value={zellePhone}
                      onChange={e => setZellePhone(e.target.value)}
                      className={inputClass}
                      placeholder="313-200-1873"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-800/90 bg-[#0c0c0e]/50 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700 bg-transparent text-zinc-300"
                onClick={() => setLocation("/admin/dashboard")}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={updateSettings.isPending}
                className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-[#DBEAFE]"
              >
                {updateSettings.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AdminShell>
  );
}
