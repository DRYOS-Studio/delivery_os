import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import type { CycleType } from "@/lib/utils/cycle-type";

export type ServiceProductRow =
  Database["public"]["Tables"]["service_products"]["Row"];

export type ServiceProductListItem = {
  id: string;
  name: string;
  slug: string;
  defaultCycleType: CycleType | null;
};

export async function listServiceProducts(): Promise<ServiceProductRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("service_products")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(`listServiceProducts: ${error.message}`);
  return data ?? [];
}

export async function listActiveServiceProducts(): Promise<
  ServiceProductListItem[]
> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("service_products")
    .select("id, name, slug, default_cycle_type")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listActiveServiceProducts: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    defaultCycleType: r.default_cycle_type,
  }));
}

export async function getServiceProduct(
  id: string,
): Promise<ServiceProductRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("service_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getServiceProduct: ${error.message}`);
  return data;
}

export async function getServiceProductBySlug(
  slug: string,
): Promise<ServiceProductRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("service_products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getServiceProductBySlug: ${error.message}`);
  return data;
}
