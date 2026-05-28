'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Lead, Profile, Status, StoreType, ChainType, City,
  STATUS_LABELS, STATUS_COLORS, STORE_TYPE_LABELS,
} from './types';

const ALL_STATUSES: Status[] = ['not_contacted', 'in_contact', 'samples_shipped', 'actively_selling', 'declined'];
const ALL_STORE_TYPES: StoreType[] = ['coffee_shop', 'gym_fitness', 'smoothie_shop', 'local_deli', 'specialty_grocer', 'other'];

interface Props {
  lead: Lead;
  profiles: Profile[];
  currentUser: Profile;
  onClose: () => void;
  onUpdate: (updated: Lead) => void;
  onDelete: (id: string) => void;
}

export default function LeadPanel({ lead, profiles, currentUser, onClose, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const supabase = createClient();

  const canEdit = currentUser.role === 'admin' || lead.sales_associate_id === currentUser.id;

  const startEdit = () => {
    setForm({
      store_name: lead.store_name,
      status: lead.status,
      store_type: lead.store_type,
      chain_type: lead.chain_type,
      contact_name: lead.contact_name,
      contact_phone: lead.contact_phone,
      contact_email: lead.contact_email,
      neighborhood: lead.neighborhood,
      notes: lead.notes,
      last_contacted_date: lead.last_contacted_date,
      sales_associate_id: lead.sales_associate_id,
      city: lead.city,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from('leads')
      .update(form)
      .eq('id', lead.id)
      .select('*, profiles!sales_associate_id(id, name, role)')
      .single();

    setSaving(false);
    if (!error && data) {
      onUpdate(data as Lead);
      setEditing(false);
      setForm({});
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${lead.store_name}"? This cannot be undone.`)) return;
    await supabase.from('leads').delete().eq('id', lead.id);
    onDelete(lead.id);
  };

  const f = <T,>(key: keyof Lead, fallback: T) =>
    editing ? (form[key] ?? lead[key] ?? fallback) : (lead[key] ?? fallback);

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-gray-100 shadow-xl z-10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="flex-1 min-w-0 pr-2">
          {editing ? (
            <input
              value={(form.store_name ?? lead.store_name) as string}
              onChange={(e) => setForm((p) => ({ ...p, store_name: e.target.value }))}
              className="w-full font-semibold text-gray-900 border-b border-green-500 focus:outline-none text-sm"
            />
          ) : (
            <h2 className="font-semibold text-gray-900 text-sm leading-snug truncate">
              {lead.store_name}
            </h2>
          )}
          {lead.neighborhood && (
            <p className="text-xs text-gray-400 mt-0.5">{lead.neighborhood}</p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 text-lg leading-none">
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {/* Status */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
          {editing ? (
            <select
              value={(form.status ?? lead.status) as string}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Status }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          ) : (
            <div className="mt-1">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                style={{ background: STATUS_COLORS[lead.status] }}
              >
                {STATUS_LABELS[lead.status]}
              </span>
            </div>
          )}
        </div>

        {/* Associate */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Associate</label>
          {editing && currentUser.role === 'admin' ? (
            <select
              value={(form.sales_associate_id ?? lead.sales_associate_id ?? '') as string}
              onChange={(e) => setForm((p) => ({ ...p, sales_associate_id: e.target.value || null }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : (
            <p className="mt-1 text-gray-700">{lead.profiles?.name ?? 'Unassigned'}</p>
          )}
        </div>

        {/* Store info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
            {editing ? (
              <select
                value={(form.store_type ?? lead.store_type ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, store_type: (e.target.value || null) as StoreType | null }))}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">—</option>
                {ALL_STORE_TYPES.map((t) => (
                  <option key={t} value={t}>{STORE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-gray-700">{lead.store_type ? STORE_TYPE_LABELS[lead.store_type] : '—'}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chain</label>
            {editing ? (
              <select
                value={(form.chain_type ?? lead.chain_type ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, chain_type: (e.target.value || null) as ChainType | null }))}
                className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">—</option>
                <option value="local">Local</option>
                <option value="corporate_chain">Corporate</option>
              </select>
            ) : (
              <p className="mt-1 text-gray-700">
                {lead.chain_type === 'local' ? 'Local' : lead.chain_type === 'corporate_chain' ? 'Corporate' : '—'}
              </p>
            )}
          </div>
        </div>

        {/* City */}
        {editing && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">City</label>
            <select
              value={(form.city ?? lead.city) as string}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value as City }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="nyc">NYC</option>
              <option value="sf">SF</option>
            </select>
          </div>
        )}

        {/* Address */}
        {lead.address && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</label>
            <p className="mt-1 text-gray-700 text-xs leading-relaxed">{lead.address}</p>
          </div>
        )}

        {/* Contact */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Point of Contact</label>
          {editing ? (
            <div className="mt-1 space-y-1.5">
              <input
                placeholder="Name"
                value={(form.contact_name ?? lead.contact_name ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value || null }))}
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                placeholder="Phone"
                value={(form.contact_phone ?? lead.contact_phone ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value || null }))}
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                placeholder="Email"
                value={(form.contact_email ?? lead.contact_email ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value || null }))}
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {lead.contact_name && <p className="text-gray-700">{lead.contact_name}</p>}
              {lead.contact_phone && <p className="text-gray-500 text-xs">{lead.contact_phone}</p>}
              {lead.contact_email && (
                <a href={`mailto:${lead.contact_email}`} className="text-green-600 text-xs hover:underline">
                  {lead.contact_email}
                </a>
              )}
              {!lead.contact_name && !lead.contact_phone && !lead.contact_email && (
                <p className="text-gray-400">—</p>
              )}
            </div>
          )}
        </div>

        {/* Last Contacted */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Contacted</label>
          {editing ? (
            <input
              type="date"
              value={(form.last_contacted_date ?? lead.last_contacted_date ?? '') as string}
              onChange={(e) => setForm((p) => ({ ...p, last_contacted_date: e.target.value || null }))}
              className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          ) : (
            <p className="mt-1 text-gray-700">
              {lead.last_contacted_date
                ? new Date(lead.last_contacted_date).toLocaleDateString()
                : '—'}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
          {editing ? (
            <textarea
              value={(form.notes ?? lead.notes ?? '') as string}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value || null }))}
              rows={4}
              className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          ) : (
            <p className="mt-1 text-gray-700 text-xs leading-relaxed whitespace-pre-wrap">
              {lead.notes || '—'}
            </p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-gray-100 flex gap-2">
        {editing ? (
          <>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancelEdit}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {canEdit && (
              <button
                onClick={startEdit}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-2 rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
            {currentUser.role === 'admin' && (
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium py-2 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
