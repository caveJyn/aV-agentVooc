export function normalizeEmailId(id: string): string {
  if (!id) return "";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  let normalized = id.trim();
  normalized = normalized.replace(/^[<'"]+/, '').replace(/[>'"]+$/, '');
  return normalized.includes("@") ? normalized : "";
}