import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { api, jsonRequest } from "../services/api/apiClient";

type BusinessProfile = {
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  default_terms: string;
  default_validity_days: number;
  currency: "INR";
};
const blank: BusinessProfile = {
  business_name: "", contact_person: "", email: "", phone: "", address: "",
  website: "", default_terms: "", default_validity_days: 30, currency: "INR",
};

export default function BusinessProfileForm() {
  const [profile, setProfile] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    api<BusinessProfile>("/api/business-profile")
      .then((value) => { if (active) setProfile(value); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "Unable to load business profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const update = (key: keyof BusinessProfile, value: string | number) => setProfile((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const saved = await api<BusinessProfile>("/api/business-profile", jsonRequest("PUT", profile));
      setProfile(saved);
      toast.success("Business profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save business profile.");
    } finally { setSaving(false); }
  };
  return <section className="business-panel profile-panel">
    <h2>Business profile</h2>
    <p>These details can be used on customer quotations. Currency is currently INR.</p>
    {loading ? <div role="status">Loading business profile…</div> : loadError ? <div className="workflow-error" role="alert">{loadError}</div> : <form className="workflow-form-grid" onSubmit={save}>
      <label>Business name<input maxLength={160} value={profile.business_name} onChange={e=>update("business_name",e.target.value)}/></label>
      <label>Contact person<input maxLength={160} value={profile.contact_person} onChange={e=>update("contact_person",e.target.value)}/></label>
      <label>Email<input type="email" maxLength={254} value={profile.email} onChange={e=>update("email",e.target.value)}/></label>
      <label>Phone<input maxLength={40} value={profile.phone} onChange={e=>update("phone",e.target.value)}/></label>
      <label>Website<input type="url" maxLength={300} value={profile.website} onChange={e=>update("website",e.target.value)}/></label>
      <label>Default validity (days)<input required type="number" min={1} max={365} value={profile.default_validity_days} onChange={e=>update("default_validity_days",Number(e.target.value))}/></label>
      <label className="wide">Business address<textarea rows={2} maxLength={1000} value={profile.address} onChange={e=>update("address",e.target.value)}/></label>
      <label className="wide">Default quotation terms<textarea rows={3} maxLength={4000} value={profile.default_terms} onChange={e=>update("default_terms",e.target.value)}/></label>
      <label>Currency<select value={profile.currency} disabled><option value="INR">INR — Indian Rupee</option></select></label>
      <div className="wide"><button type="submit" className="studio-button" disabled={saving}><Save size={15}/>{saving ? "Saving…" : "Save business profile"}</button></div>
    </form>}
  </section>;
}
