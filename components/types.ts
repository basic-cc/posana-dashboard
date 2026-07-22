export type StoreType = 'coffee_shop' | 'gym_fitness' | 'smoothie_shop' | 'local_deli' | 'specialty_grocer' | 'other';
export type ChainType = 'local' | 'corporate_chain';
export type Status = 'not_contacted' | 'in_contact' | 'samples_shipped' | 'actively_selling' | 'declined';
export type City = string;
export type Role = 'admin' | 'associate';

export interface CityMeta {
  label: string;
  state: string;
  lat: number | null;
  lng: number | null;
}

export const CITY_META: Record<string, CityMeta> = {
  nyc: { label: 'NYC', state: 'NY', lat: 40.7128, lng: -74.006 },
  sf: { label: 'SF', state: 'CA', lat: 37.7749, lng: -122.4194 },
  berkeley: { label: 'Berkeley', state: 'CA', lat: 37.8708, lng: -122.2729 },
  oakland: { label: 'Oakland', state: 'CA', lat: 37.8045, lng: -122.2714 },
  sacramento: { label: 'Sacramento', state: 'CA', lat: 38.5811, lng: -121.4939 },
  'grass-valley': { label: 'Grass Valley', state: 'CA', lat: 39.2191, lng: -121.0629 },
  arbuckle: { label: 'Arbuckle', state: 'CA', lat: 39.0135, lng: -122.0629 },
  'menlo-park': { label: 'Menlo Park', state: 'CA', lat: 37.452, lng: -122.178 },
  bakersfield: { label: 'Bakersfield', state: 'CA', lat: 35.3739, lng: -119.0195 },
  'laguna-beach': { label: 'Laguna Beach', state: 'CA', lat: 33.5427, lng: -117.7854 },
  stockton: { label: 'Stockton', state: 'CA', lat: 37.9577, lng: -121.2908 },
  stanford: { label: 'Stanford', state: 'CA', lat: 37.4265, lng: -122.1703 },
  'santa-monica': { label: 'Santa Monica', state: 'CA', lat: 34.0195, lng: -118.4912 },
  'sand-city': { label: 'Sand City', state: 'CA', lat: 36.6172, lng: -121.8483 },
  lafayette: { label: 'Lafayette', state: 'CA', lat: 37.8858, lng: -122.118 },
  'redwood-city': { label: 'Redwood City', state: 'CA', lat: 37.4863, lng: -122.2325 },
  'redondo-beach': { label: 'Redondo Beach', state: 'CA', lat: 33.8398, lng: -118.3846 },
  raleigh: { label: 'Raleigh', state: 'NC', lat: 35.7804, lng: -78.6391 },
  arvada: { label: 'Arvada', state: 'CO', lat: 39.8006, lng: -105.0812 },
  'new-orleans': { label: 'New Orleans', state: 'LA', lat: 29.9561, lng: -90.0734 },
  bloomfield: { label: 'Bloomfield', state: 'NJ', lat: 40.7935, lng: -74.1979 },
  unknown: { label: 'Unconfirmed', state: 'Other', lat: null, lng: null },
};

export function cityLabel(city: string): string {
  return CITY_META[city]?.label ?? city;
}

export interface Profile {
  id: string;
  name: string;
  role: Role;
  labels: string[];
}

// Sentinel value for Filters.associateId meaning "unassigned leads only"
export const UNCLAIMED = '__unclaimed__';

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
  label: string;
}
