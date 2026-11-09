import type { ClientRegistrationSubmission } from "@/lib/validators/client-registration";
import { slugify } from "@/lib/utils/slug";

export type ClientInsertFromSubmission = {
  name: string;
  slug: string;
  legal_name: string | null;
  cnpj: string | null;
  cpf: string | null;
  person_type: "pf" | "pj";
  profession: string | null;
  marital_status: string | null;
  trade_name: string | null;
  formal_email: string | null;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  focal_point_name: string;
  focal_point_email: string;
  focal_point_phone: string;
  financial_contact_name: string;
  financial_contact_email: string;
  financial_contact_phone: string;
  legal_representative_name: string | null;
  legal_representative_role: string | null;
  legal_representative_cpf: string | null;
  legal_representative_email: string | null;
  address_street: string;
  address_number: string;
  address_complement: string | null;
  address_district: string;
  address_city: string;
  address_state: string;
  address_zip: string;
};

function uniqueSlug(base: string, attempt: number): string {
  const slug = slugify(base);
  if (attempt === 0) return slug.slice(0, 60);
  const suffix = `-${attempt}`;
  return `${slug.slice(0, 60 - suffix.length)}${suffix}`;
}

export function clientPayloadFromSubmission(
  data: ClientRegistrationSubmission,
  slugAttempt = 0,
): ClientInsertFromSubmission {
  const address = {
    address_street: data.address_street,
    address_number: data.address_number,
    address_complement: data.address_complement ?? null,
    address_district: data.address_district,
    address_city: data.address_city,
    address_state: data.address_state,
    address_zip: data.address_zip,
  };

  const contacts = {
    focal_point_name: data.focal_point_name,
    focal_point_email: data.focal_point_email,
    focal_point_phone: data.focal_point_phone,
    financial_contact_name: data.financial_contact_name,
    financial_contact_email: data.financial_contact_email,
    financial_contact_phone: data.financial_contact_phone,
    primary_contact_name: data.focal_point_name,
    primary_contact_email: data.focal_point_email,
    primary_contact_phone: data.focal_point_phone,
  };

  if (data.person_type === "pf") {
    return {
      person_type: "pf",
      name: data.full_name,
      slug: uniqueSlug(data.full_name, slugAttempt),
      legal_name: null,
      cnpj: null,
      cpf: data.cpf,
      profession: data.profession,
      marital_status: data.marital_status,
      trade_name: null,
      formal_email: data.formal_email,
      legal_representative_name: null,
      legal_representative_role: null,
      legal_representative_cpf: null,
      legal_representative_email: null,
      ...address,
      ...contacts,
    };
  }

  const displayName = data.trade_name?.trim() || data.legal_name;
  return {
    person_type: "pj",
    name: displayName,
    slug: uniqueSlug(displayName, slugAttempt),
    legal_name: data.legal_name,
    cnpj: data.cnpj,
    cpf: null,
    profession: null,
    marital_status: null,
    trade_name: data.trade_name ?? null,
    formal_email: data.legal_representative_email,
    legal_representative_name: data.legal_representative_name,
    legal_representative_role: data.legal_representative_role,
    legal_representative_cpf: data.legal_representative_cpf,
    legal_representative_email: data.legal_representative_email,
    ...address,
    ...contacts,
  };
}
