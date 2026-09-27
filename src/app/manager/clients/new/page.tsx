"use client";
import { Header } from "@/components/layout/header";
import { ClientForm } from "@/components/forms/client-form";

export default function NewClientPage() {
  return (
    <div>
      <Header title="Add PT Client" subtitle="Register a new personal training client" />
      <div className="px-8 py-6 max-w-2xl">
        <ClientForm />
      </div>
    </div>
  );
}
