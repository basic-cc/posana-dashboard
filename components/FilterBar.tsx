'use client';

import { Lead, Profile, Filters, Status, StoreType, City, CITY_META, cityLabel, STATUS_LABELS, STATUS_COLORS, STORE_TYPE_LABELS, UNCLAIMED } from './types';

const ALL_STATUSES: Status[] = ['not_contacted', 'in_contact', 'samples_shipped', 'actively_selling', 'declined'];
const ALL_STORE_TYPES: StoreType[] = ['coffee_shop', 'gym_fitness', 'smoothie_shop', 'local_deli', 'specialty_grocer', 'other'];

interface Props {
  filters: Filters;
  profiles: Profile[];
  leads: Lead[];
  filteredCount: number;
  onChange: (f: Filters) => void;
}

export default function FilterBar({ filters, profiles, leads, filteredCount, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const neighborhoods = Array.from(
    new Set(leads.map((l) => l.neighborhood).filter((n): n is string => !!n))
  ).sort((a, b) => a.localeCompare(b));

  const citiesByState = Array.from(new Set(leads.map((l) => l.city).filter(Boolean)))
    .reduce<Record<string, City[]>>((acc, c) => {
      const state = CITY_META[c]?.state ?? 'Other';
      (acc[state] ??= []).push(c);
      return acc;
    }, {});
  const stateOrder = Object.keys(citiesByState).sort((a, b) =>
    a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)
  );
  stateOrder.forEach((state) =>
    citiesByState[state].sort((a, b) => cityLabel(a).localeCompare(cityLabel(b)))
  );

  const toggleStatus = (s: Status) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    set({ statuses: next });
  };

  const toggleType = (t: StoreType) => {
    const next = filters.storeTypes.includes(t)
      ? filters.storeTypes.filter((x) => x !== t)
      : [...filters.storeTypes, t];
    set({ storeTypes: next });
  };

  const clearAll = () =>
    onChange({ city: 'all', statuses: [], storeTypes: [], associateId: '', neighborhood: '', search: '', label: '' });

  const activeCount =
    (filters.city !== 'all' ? 1 : 0) +
    filters.statuses.length +
    filters.storeTypes.length +
    (filters.associateId ? 1 : 0) +
    (filters.neighborhood ? 1 : 0) +
    (filters.search ? 1 : 0) +
    (filters.label ? 1 : 0);

  const allLabels = Array.from(new Set(profiles.flatMap((p) => p.labels ?? []))).sort((a, b) => a.localeCompare(b));

  return (
    <aside className="w-64 bg-[#F0FDFB] dark:bg-gray-900 border-r border-teal-100 dark:border-gray-700 flex flex-col overflow-y-auto shrink-0">
      <div className="p-4 border-b border-teal-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Filters</span>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">
              Clear all
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{filteredCount} leads visible</p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-teal-100 dark:border-gray-700">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search stores..."
          className="w-full border border-teal-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* City */}
      <div className="p-4 border-b border-teal-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">City</p>
        <button
          onClick={() => set({ city: 'all' })}
          className={`w-full mb-2 py-1 rounded-md text-xs font-medium transition-colors ${
            filters.city === 'all'
              ? 'bg-teal-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-gray-700 border border-teal-100 dark:border-gray-600'
          }`}
        >
          All
        </button>
        <div className="space-y-2">
          {stateOrder.map((state) => (
            <div key={state}>
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{state}</p>
              <div className="flex flex-wrap gap-1">
                {citiesByState[state].map((c) => (
                  <button
                    key={c}
                    onClick={() => set({ city: c })}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      filters.city === c
                        ? 'bg-teal-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-gray-700 border border-teal-100 dark:border-gray-600'
                    }`}
                  >
                    {cityLabel(c)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Associate */}
      <div className="p-4 border-b border-teal-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">Associate</p>
        <select
          value={filters.associateId}
          onChange={(e) => set({ associateId: e.target.value })}
          className="w-full border border-teal-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All associates</option>
          <option value={UNCLAIMED}>Unclaimed</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Targeting Area (labels) */}
      {allLabels.length > 0 && (
        <div className="p-4 border-b border-teal-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">Targeting Area</p>
          <div className="flex flex-wrap gap-1">
            {allLabels.map((l) => (
              <button
                key={l}
                onClick={() => set({ label: filters.label === l ? '' : l })}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  filters.label === l
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-gray-700 border border-teal-100 dark:border-gray-600'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Neighborhood */}
      <div className="p-4 border-b border-teal-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">Neighborhood</p>
        <select
          value={filters.neighborhood}
          onChange={(e) => set({ neighborhood: e.target.value })}
          className="w-full border border-teal-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All neighborhoods</option>
          {neighborhoods.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="p-4 border-b border-teal-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">Status</p>
        <div className="space-y-1.5">
          {ALL_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.statuses.includes(s)}
                onChange={() => toggleStatus(s)}
                className="pn-checkbox"
              />
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: STATUS_COLORS[s] }}
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">{STATUS_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Store Type */}
      <div className="p-4">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">Store Type</p>
        <div className="space-y-1.5">
          {ALL_STORE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.storeTypes.includes(t)}
                onChange={() => toggleType(t)}
                className="pn-checkbox"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">{STORE_TYPE_LABELS[t]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-auto p-4 border-t border-teal-100 dark:border-gray-700 bg-teal-50/50 dark:bg-gray-800/50">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">Legend</p>
        <div className="space-y-1">
          {ALL_STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 shrink-0"
                style={{ background: STATUS_COLORS[s], boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">{STATUS_LABELS[s]}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
