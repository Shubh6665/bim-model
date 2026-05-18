"use client";
import React, { useState } from "react";
import { useSession } from "next-auth/react";

interface AdminRequestModalProps {
  show: boolean;
  onClose: () => void;
}

export function AdminRequestModal({ show, onClose }: AdminRequestModalProps) {
  const { data: session } = useSession();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState<string>(session?.user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    setEmail(session?.user?.email || "");
  }, [session?.user?.email]);

  if (!show) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      setSubmitting(true);
      const res = await fetch("/api/admins/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to submit request");
      }
      const companyText = json.company ? ` for company "${json.company}"` : '';
      setSuccess(
        `Request submitted${companyText}. Status: ${json.status}. A Platform Owner will review and approve.`
      );
      setCompany("");
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Request Administrator Access</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Fill your company details. After Platform Owner approval, you'll be able to create projects for that company.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1" htmlFor="company">
              Company Name
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="e.g., Acme Infra Pvt Ltd"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1" htmlFor="email">
              Your Email (optional)
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="you@company.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">Defaults to your login email.</p>
          </div>
          {error && (
            <div className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded p-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-400 bg-green-900/30 border border-green-700 rounded p-2">
              {success}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-10 rounded-md border border-border text-foreground hover:bg-card"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 h-10 rounded-md bg-blue-600 text-foreground font-medium shadow hover:bg-blue-700 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
