/** One vocabulary for order filters across demand, plant and tanker screens. */
export type OrderFilter = "all" | "active" | "pending" | "completed";
export type Bucket = "pending" | "active" | "completed" | "closed";

export function bucketOf(status?: string | null): Bucket {
  const s = String(status ?? "").toLowerCase();
  if (["pending", "offered", "new offer", "awaiting"].includes(s)) return "pending";
  if (["delivered", "completed"].includes(s)) return "completed";
  if (["rejected", "cancelled", "canceled", "expired", "failed"].includes(s)) return "closed";
  return "active"; // Accepted, Assigned, Out for Delivery, Picked up…
}

export function filterOptions<T>(items: T[], getStatus: (t: T) => string | undefined) {
  const count = (b: Bucket) => items.filter((i) => bucketOf(getStatus(i)) === b).length;
  return [
    { value: "all" as const, label: "All", count: items.length },
    { value: "active" as const, label: "Active", count: count("active") },
    { value: "pending" as const, label: "Pending", count: count("pending") },
    { value: "completed" as const, label: "Completed", count: count("completed") },
  ];
}

export function applyFilter<T>(items: T[], filter: OrderFilter, getStatus: (t: T) => string | undefined) {
  return filter === "all" ? items : items.filter((i) => bucketOf(getStatus(i)) === filter);
}

export const BUCKET_COLOR: Record<Bucket, string> = {
  pending: "#d97706",
  active: "#1463d6",
  completed: "#15803d",
  closed: "#8a97a8",
};
