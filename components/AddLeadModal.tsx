'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Lead, Profile, Status, StoreType, ChainType, City, STATUS_LABELS, STORE_TYPE_LABELS } from './types';

const ALL_STATUSES: Status[] = ['not_contacted', 'in_contact', 'samples_shipped', 'actively_selling', 'declined'];
const ALL_STORE_TYPES: StoreType[] = ['coffee_shop', 'gym_fitness', 'smoothie_shop', 'local_deli', 'specialty_grocer', 'other'];

interface Props {
  profiles: Profile[];
  currentUser: Profile;
  onAdd: (lead: Lead) => void;
  onClose: () => void;
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PosanaDashboard/1.0' } });
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

export default function AddLeadModal({ profiles, currentUser, onAdd, onClose }: Props) {
  const supabase = createClient();
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geocoded, setGeocoded] = useState<[number, number] | null>(null);
  const [form, setForm] = useState({
    store_name: '',
    address: '',
    store_type: '' as StoreType | '',
    chain_type: '' as ChainType | '',
    status: 'not_contacted' as Status,
    sales_associate_id: currentUser.id,
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    neighborhood: '',
    notes: '',
    last_contacted_date: '',
    city: 'nyc' as City,
  });

  const set = (patch: Partial<typeof form>) => setForm((p) => ({ ...p, ...patch }));

  const handleGeocode = async () => {
    if (!form.address) return;
    setGeocoding(true);
    const coords = await geocodeAddress(form.address);
    setGeocoded(coords);
    setGeocoding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let lat: number | null = null;
    let lng: number | null = null;

    if (geocoded) {
      [lat, lng] = geocoded;
    } else if (form.address) {
      const coords = await geocodeAddress(form.address);
      if (coords) [lat, lng] = coords;
    }

    const payload = {
      store_name: form.store_name,
      address: form.address || null,
      lat,
      lng,
      store_type: (form.store_type || null) as StoreType | null,
      chain_type: (form.chain_type || null) as ChainType | null,
      status: form.status,
      sales_associate_id: form.sales_associate_id || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      neighborhood: form.neighborhood || null,
      notes: form.notes || null,
      last_contacted_date: form.last_contacted_date || null,
      city: form.city,
    };

    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select('*, profiles!sales_associate_id(id, name, role)')
      .single();

    setSaving(false);
    if (!error && data) onAdd(data as Lead);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Store Name *</label>
              <input
                required
                value={form.store_name}
                onChange={(e) => set({ store_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g. Blue Bottle Coffee"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <select
                value={form.city}
                onChange={(e) => set({ city: e.target.value as City })}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="nyc">NYC</option>
                <option value="sf">SF</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Neighborhood</label>
              <input
                value={form.neighborhood}
                onChange={(e) => set({ neighborhood: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g. Tribeca"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
              <div className="flex gap-2">
                <input
                  value={form.address}
                  onChange={(e) => { set({ address: e.target.value }); setGeocoded(null); }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="123 Main St, New York, NY"
                />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding || !form.address}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg text-xs font-medium text-gray-700 transition-colors whitespace-nowrap"
                >
                  {geocoding ? '...' : geocoded ? 'Pinned ✓' : 'Pin'}
                </button>
              </div>
              {geocoded && (
                <p className="text-xs text-teal-600 mt-1">
                  Located: {geocoded[0].toFixed(4)}, {geocoded[1].toFixed(4)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Store Type</label>
              <select
                value={form.store_type}
                onChange={(e) => set({ store_type: e.target.value as StoreType | '' })}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select type</option>
                {ALL_STORE_TYPES.map((t) => (
                  <option key={t} value={t}>{STORE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Local / Corporate</label>
              <select
                value={form.chain_type}
                onChange={(e) => set({ chain_type: e.target.value as ChainType | '' })}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select</option>
                <option value="local">Local / Independent</option>
                <option value="corporate_chain">Corporate Chain</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => set({ status: e.target.value as Status })}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
              <select
                value={form.sales_associate_id}
                onChange={(e) => set({ sales_associate_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                value={form.contact_name}
                onChange={(e) => set({ contact_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Phone</label>
              <input
                value={form.contact_phone}
                onChange={(e) => set({ contact_phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => set({ contact_email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Last Contacted</label>
              <input
                type="date"
                value={form.last_contacted_date}
                onChange={(e) => set({ last_contacted_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
          </div>
        </form>

        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            type="submit"
            form=""
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving || !form.store_name}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Adding...' : 'Add Lead'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
