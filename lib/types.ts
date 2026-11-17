export type ContactRole = "owner" | "broker" | "buyer";
export type ListingSource = "direct_owner" | "broker";
export type PropertyType =
  | "plot" | "house" | "flat" | "shop" | "showroom"
  | "commercial_plot" | "agri_land" | "warehouse" | "other";
export type PropertyPurpose = "sale" | "rent";
export type PropertyStatus = "available" | "on_hold" | "sold" | "rented" | "withdrawn";
export type SizeUnit = "gaj" | "sq_ft" | "marla" | "kanal" | "acre" | "killa";
export type CommissionType = "direct" | "shared";
export type CommissionStatus = "expected" | "partially_received" | "received" | "written_off";
export type PaymentMode = "cash" | "upi" | "bank" | "cheque";

export const ROLES: ContactRole[] = ["owner", "broker", "buyer"];
export const PROPERTY_TYPES: PropertyType[] = [
  "plot", "house", "flat", "shop", "showroom", "commercial_plot", "agri_land", "warehouse", "other",
];
export const STATUSES: PropertyStatus[] = ["available", "on_hold", "sold", "rented", "withdrawn"];
export const UNITS: SizeUnit[] = ["gaj", "sq_ft", "marla", "kanal", "acre", "killa"];
export const PAYMENT_MODES: PaymentMode[] = ["cash", "upi", "bank", "cheque"];

export interface Contact {
  id: string;
  name: string;
  phone: string;
  alt_phone: string | null;
  city: string | null;
  area: string | null;
  roles: ContactRole[];
  notes: string | null;
  listings_count: number;
  created_at: string;
}

export type ContactLite = Pick<Contact, "id" | "name" | "phone" | "area" | "roles">;

export interface Property {
  id: string;
  property_type: PropertyType;
  purpose: PropertyPurpose;
  status: PropertyStatus;
  city: string;
  locality: string;
  plot_no: string | null;
  size_value: number | null;
  size_unit: SizeUnit;
  price: number | null;
  price_negotiable: boolean;
  facing: string | null;
  road_width_ft: number | null;
  listing_source: ListingSource;
  source_contact_id: string;
  owner_contact_id: string | null;
  received_date: string;
  notes: string | null;
}

/**
 * Exactly the columns of the `public_property_card` view. The share feature
 * may only ever see this shape — no names, no owner/broker phones, no notes,
 * no commission.
 */
export interface PublicPropertyCard {
  id: string;
  property_type: PropertyType;
  purpose: PropertyPurpose;
  city: string;
  locality: string;
  plot_no: string | null;
  size_value: number | null;
  size_unit: SizeUnit;
  price: number | null;
  price_negotiable: boolean;
  status: PropertyStatus;
  photo_paths: string[];
  business_name: string;
  public_phone: string;
}

export interface CommissionOverview {
  id: string;
  property_id: string;
  type: CommissionType;
  shared_with_contact_id: string | null;
  shared_with_name: string | null;
  buyer_contact_id: string | null;
  deal_amount: number | null;
  our_share_percent: number | null;
  our_share_amount: number | null;
  expected_amount: number;
  received_amount: number;
  pending_amount: number;
  status: CommissionStatus;
  deal_date: string;
  last_paid_on: string | null;
  payments_count: number;
  property_type: PropertyType;
  locality: string;
  city: string;
  plot_no: string | null;
  size_value: number | null;
  size_unit: SizeUnit;
}

export interface DuplicateMatch {
  id: string;
  match_reason: "same_plot" | "same_size_price";
  property_type: PropertyType;
  locality: string;
  plot_no: string | null;
  size_value: number | null;
  size_unit: SizeUnit;
  price: number | null;
  received_date: string;
  source_names: string[];
}
