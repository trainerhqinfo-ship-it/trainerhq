"use client";
import { Header } from "@/components/layout/header";
import { TrainerForm } from "@/components/forms/trainer-form";

export default function NewTrainerPage() {
  return (
    <div>
      <Header title="Add Trainer" subtitle="Onboard a new personal trainer" />
      <div className="px-8 py-6 max-w-4xl">
        <TrainerForm />
      </div>
    </div>
  );
}
