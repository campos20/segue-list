function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

/** A readable, collision-resistant id: a slug of `seed` plus the current time in base36. */
export function generateId(seed: string): string {
  return `${slugify(seed)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
