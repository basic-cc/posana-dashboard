'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Lead, Profile, Status, StoreType, ChainType, City, CITY_META, cityLabel,
  STATUS_LABELS, STATUS_COLORS, STORE_TYPE_LABELS,
} from './types';

const ALL_STATUSES: Status[] = ['not_contacted', 'in_contact', 'samples_shipped', 'actively_selling', 'declined'];
const ALL_STORE_TYPES: StoreType[] = ['coffee_shop', 'gym_fitness', 'smoothie_shop', 'local_deli', 'specialty_grocer', 'other'];

const CITIES_BY_STATE = Object.entries(CITY_META).reduce<Record<string, string[]>>((acc, [slug, meta]) => {
  (acc[meta.state] ??= []).push(slug);
  return acc;
}, {});
const STATE_ORDER = Object.keys(CITIES_BY_STATE).sort((a, b) =>
  a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)
);

interface Props {
  lead: Lead;
  profiles: Profile[];
  currentUser: Profile;
  onClose: () => void;
  onUpdate: (updated: Lead) => void;
  onDelete: (id: string) => void;
  onClaim: (lead: Lead) => void;
}

function fieldsFromLead(lead: Lead): Partial<Lead> {
  return {
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
  };
}

export default function LeadPanel({ lead, profiles, currentUser, onClose, onUpdate, onDelete, onClaim }: Props) {
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const canEdit = currentUser.role === 'admin' || lead.sales_associate_id === currentUser.id;

  // The parent keys this component by lead.id, so selecting a different lead remounts it —
  // fields start out editable immediately (if the user has permission), no separate "Edit" click.
  const [form, setForm] = useState<Partial<Lead>>(() => (canEdit ? fieldsFromLead(lead) : {}));

  const resetForm = () => setForm(fieldsFromLead(lead));

  const isDirty = canEdit && (Object.keys(form) as (keyof Lead)[]).some((key) => lead[key] !== form[key]);

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
      setForm(fieldsFromLead(data as Lead));
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${lead.store_name}"? This cannot be undone.`)) return;
    await supabase.from('leads').delete().eq('id', lead.id);
    onDelete(lead.id);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-700 shadow-xl z-10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex-1 min-w-0 pr-2">
          {canEdit ? (
            <input
              value={(form.store_name ?? lead.store_name) as string}
              onChange={(e) => setForm((p) => ({ ...p, store_name: e.target.value }))}
              className="w-full font-semibold bg-transparent border-b border-teal-500 focus:outline-none text-sm text-gray-900 dark:text-gray-100"
            />
          ) : (
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug truncate">
              {lead.store_name}
            </h2>
          )}
          {lead.neighborhood && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{lead.neighborhood}</p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 text-lg leading-none">
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {/* Status */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</label>
          {canEdit ? (
            <select
              value={(form.status ?? lead.status) as string}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Status }))}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Associate</label>
          {canEdit && currentUser.role === 'admin' ? (
            <select
              value={(form.sales_associate_id ?? lead.sales_associate_id ?? '') as string}
              onChange={(e) => setForm((p) => ({ ...p, sales_associate_id: e.target.value || null }))}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : (
            <div className="mt-1">
              <p className="text-gray-700 dark:text-gray-300">{lead.profiles?.name ?? 'Unassigned'}</p>
              {lead.profiles?.labels && lead.profiles.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {lead.profiles.labels.map((l) => (
                    <span
                      key={l}
                      className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
              {lead.sales_associate_id === null && (
                <button
                  type="button"
                  onClick={() => onClaim(lead)}
                  className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors"
                >
                  Claim this store
                </button>
              )}
            </div>
          )}
        </div>

        {/* Store info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</label>
            {canEdit ? (
              <select
                value={(form.store_type ?? lead.store_type ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, store_type: (e.target.value || null) as StoreType | null }))}
                className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">—</option>
                {ALL_STORE_TYPES.map((t) => (
                  <option key={t} value={t}>{STORE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-gray-700 dark:text-gray-300">{lead.store_type ? STORE_TYPE_LABELS[lead.store_type] : '—'}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chain</label>
            {canEdit ? (
              <select
                value={(form.chain_type ?? lead.chain_type ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, chain_type: (e.target.value || null) as ChainType | null }))}
                className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">—</option>
                <option value="local">Local</option>
                <option value="corporate_chain">Corporate</option>
              </select>
            ) : (
              <p className="mt-1 text-gray-700 dark:text-gray-300">
                {lead.chain_type === 'local' ? 'Local' : lead.chain_type === 'corporate_chain' ? 'Corporate' : '—'}
              </p>
            )}
          </div>
        </div>

        {/* City */}
        {canEdit && (
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">City</label>
            <select
              value={(form.city ?? lead.city) as string}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value as City }))}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {STATE_ORDER.map((state) => (
                <optgroup key={state} label={state}>
                  {CITIES_BY_STATE[state].map((slug) => (
                    <option key={slug} value={slug}>{cityLabel(slug)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {/* Address */}
        {lead.address && (
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</label>
            <p className="mt-1 text-gray-700 dark:text-gray-300 text-xs leading-relaxed">{lead.address}</p>
          </div>
        )}

        {/* Contact */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Point of Contact</label>
          {canEdit ? (
            <div className="mt-1 space-y-1.5">
              <input
                placeholder="Name"
                value={(form.contact_name ?? lead.contact_name ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value || null }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                placeholder="Phone"
                value={(form.contact_phone ?? lead.contact_phone ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value || null }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                placeholder="Email"
                value={(form.contact_email ?? lead.contact_email ?? '') as string}
                onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value || null }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          ) : (
            <div className="mt-1 space-y-0.5">
              {lead.contact_name && <p className="text-gray-700 dark:text-gray-300">{lead.contact_name}</p>}
              {lead.contact_phone && <p className="text-gray-500 dark:text-gray-400 text-xs">{lead.contact_phone}</p>}
              {lead.contact_email && (
                <a href={`mailto:${lead.contact_email}`} className="text-teal-600 dark:text-teal-400 text-xs hover:underline">
                  {lead.contact_email}
                </a>
              )}
              {!lead.contact_name && !lead.contact_phone && !lead.contact_email && (
                <p className="text-gray-400 dark:text-gray-500">—</p>
              )}
            </div>
          )}
        </div>

        {/* Last Contacted */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Contacted</label>
          {canEdit ? (
            <input
              type="date"
              value={(form.last_contacted_date ?? lead.last_contacted_date ?? '') as string}
              onChange={(e) => setForm((p) => ({ ...p, last_contacted_date: e.target.value || null }))}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          ) : (
            <p className="mt-1 text-gray-700 dark:text-gray-300">
              {lead.last_contacted_date
                ? new Date(lead.last_contacted_date).toLocaleDateString()
                : '—'}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</label>
          {canEdit ? (
            <textarea
              value={(form.notes ?? lead.notes ?? '') as string}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value || null }))}
              rows={4}
              className="mt-1 w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          ) : (
            <p className="mt-1 text-gray-700 dark:text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
              {lead.notes || '—'}
            </p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
        {canEdit && (
          <>
            <button
              onClick={save}
              disabled={saving || !isDirty}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              disabled={!isDirty}
              className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-200 text-xs font-medium py-2 rounded-lg transition-colors"
            >
              Reset
            </button>
          </>
        )}
        {currentUser.role === 'admin' && (
          <button
            onClick={handleDelete}
            className="flex-1 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 text-red-600 dark:text-red-400 text-xs font-medium py-2 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
