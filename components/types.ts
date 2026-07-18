export type StoreType = 'coffee_shop' | 'gym_fitness' | 'smoothie_shop' | 'local_deli' | 'specialty_grocer' | 'other';
export type ChainType = 'local' | 'corporate_chain';
export type Status = 'not_contacted' | 'in_contact' | 'samples_shipped' | 'actively_selling' | 'declined';
export type City = 'nyc' | 'sf';
export type Role = 'admin' | 'associate';

export interface Profile {
  id: string;
  name: string;
  role: Role;
}

export interface Lead {
  id: string;
  store_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  store_type: StoreType | null;
  chain_type: ChainType | null;
  status: Status;
  sales_associate_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  neighborhood: string | null;
  chain_group: string | null;
  notes: string | null;
  last_contacted_date: string | null;
  city: City;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
}

export const STATUS_LABELS: Record<Status, string> = {
  not_contacted: 'Not Contacted',
  in_contact: 'In Contact',
  samples_shipped: 'Samples Shipped',
  actively_selling: 'Actively Selling',
  declined: 'Declined / Dead',
};

export const STATUS_COLORS: Record<Status, string> = {
  not_contacted: '#9CA3AF',
  in_contact: '#F59E0B',
  samples_shipped: '#F97316',
  actively_selling: '#22C55E',
  declined: '#EF4444',
};

export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  coffee_shop: 'Coffee Shop',
  gym_fitness: 'Gym / Fitness',
  smoothie_shop: 'Smoothie Shop',
  local_deli: 'Local Deli',
  specialty_grocer: 'Specialty Grocer',
  other: 'Other',
};

export interface Filters {
  city: 'all' | City;
  statuses: Status[];
  storeTypes: StoreType[];
  associateId: string;
  neighborhood: string;
  search: string;
}
