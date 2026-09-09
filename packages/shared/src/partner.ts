import type { Partner } from "./types.ts";

function stripCompanyPrefix(name: string): string {
  return name
    .replace(/株式会社/g, "")
    .replace(/有限会社/g, "")
    .replace(/御中/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function normalizeRegistrationNo(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "").toUpperCase();
  const match = compact.match(/T\d{13}/);
  return match ? match[0] : compact || null;
}

export type PartnerMatch =
  | { status: "matched"; partner: Partner; via: "registration_no" | "name" | "alias" | "normalized_name" }
  | { status: "ambiguous"; partners: Partner[] }
  | { status: "none" };

export function matchPartner(
  partners: Partner[],
  input: { supplierNameRaw: string; registrationNoRaw: string | null },
): PartnerMatch {
  const reg = normalizeRegistrationNo(input.registrationNoRaw);
  if (reg) {
    const byReg = partners.filter((p) => p.registration_no.toUpperCase() === reg);
    if (byReg.length === 1) {
      return { status: "matched", partner: byReg[0], via: "registration_no" };
    }
    if (byReg.length > 1) return { status: "ambiguous", partners: byReg };
  }

  const raw = input.supplierNameRaw.trim();
  if (!raw) return { status: "none" };

  const exactName = partners.filter((p) => p.name === raw);
  if (exactName.length === 1) {
    return { status: "matched", partner: exactName[0], via: "name" };
  }

  const exactAlias = partners.filter((p) => p.aliases.includes(raw));
  if (exactAlias.length === 1) {
    return { status: "matched", partner: exactAlias[0], via: "alias" };
  }

  const needle = stripCompanyPrefix(raw);
  if (!needle) return { status: "none" };

  const normalized = partners.filter((p) => {
    const names = [p.name, ...p.aliases].map(stripCompanyPrefix);
    return names.some((n) => n === needle || n.includes(needle) || needle.includes(n));
  });

  if (normalized.length === 1) {
    return { status: "matched", partner: normalized[0], via: "normalized_name" };
  }
  if (normalized.length > 1) return { status: "ambiguous", partners: normalized };
  return { status: "none" };
}
