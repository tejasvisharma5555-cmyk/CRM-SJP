"use client";
import { useRouter } from "next/navigation";
import { ContactForm } from "./ContactForm";
import type { Contact } from "@/lib/types";

export function ContactFormPage({ initial, defaultCity }: { initial?: Contact; defaultCity: string }) {
  const router = useRouter();
  return (
    <div className="card">
      <ContactForm
        initial={initial}
        defaultCity={defaultCity}
        afterSave={(id) => { router.push(`/contacts/${id}`); router.refresh(); }}
        onCancel={() => router.back()}
      />
    </div>
  );
}
