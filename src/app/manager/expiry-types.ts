export interface ExpiryEntry {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  trainerName: string | null;
  trainerId: string | null;
  assignmentId: string | null;
  packageId: string;
  packageName: string | null;
  startDate: string | null;
  endDate: string;
  /** Negative = already expired (days since expiry = Math.abs(this)) */
  daysUntilExpiry: number;
  amountCollected: number | null;
  status: "expired" | "today" | "7days" | "30days";
}
