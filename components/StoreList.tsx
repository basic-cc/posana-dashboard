'use client';

import { useMemo, useState } from 'react';
import { Lead, Profile, Status, STATUS_COLORS, STATUS_LABELS, STORE_TYPE_LABELS } from './types';

interface Props {
  leads: Lead[];
  selectedLeadId?: string;
  currentUser: Profile;
  onLeadSelect: (lead: Lead) => void;
  onLocate: (lead: Lead) => void;
  onAssignChain: (lead: Lead, chainGroup: string | null) => void;
  onClaim: (lead: Lead) => void;
}

interface ChainGroup {
  name: string;
  leads: Lead[];
}

type ListItem = { type: 'single'; lead: Lead } | { type: 'chain'; group: ChainGroup };

function groupKey(lead: Lead): string {
  return lead.chain_group?.trim() || lead.store_name;
}

export default function StoreList({ leads, selectedLeadId, currentUser, onLeadSelect, onLocate, onAssignChain, onClaim }: Props) {
  const [groupChains, setGroupChains] = useState(true);
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  const items = useMemo<ListItem[]>(() => {
    if (!groupChains) return leads.map((lead) => ({ type: 'single', lead }));

    const byName = new Map<string, Lead[]>();
    for (const lead of leads) {
      const key = groupKey(lead);
      const group = byName.get(key);
      if (group) group.push(lead);
      else byName.set(key, [lead]);
    }

    const result: ListItem[] = [];
    for (const [name, group] of byName) {
      if (group.length > 1) result.push({ type: 'chain', group: { name, leads: group } });
      else result.push({ type: 'single', lead: group[0] });
    }
    result.sort((a, b) => {
      const an = a.type === 'single' ? a.lead.store_name : a.group.name;
      const bn = b.type === 'single' ? b.lead.store_name : b.group.name;
      return an.localeCompare(bn);
    });
    return result;
  }, [leads, groupChains]);

  const existingChains = useMemo(() => {
    const names = items.filter((i): i is { type: 'chain'; group: ChainGroup } => i.type === 'chain').map((i) => i.group.name);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const toggleChain = (name: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <aside className="w-80 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden shrink-0">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stores</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={groupChains}
              onChange={(e) => setGroupChains(e.target.checked)}
              className="pn-checkbox"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">Group chains</span>
          </label>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{leads.length} stores</p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {items.length === 0 && (
          <p className="p-4 text-xs text-gray-400 dark:text-gray-500">No stores match the current filters.</p>
        )}
        {items.map((item) =>
          item.type === 'single' ? (
            <StoreRow
              key={item.lead.id}
              lead={item.lead}
              selected={item.lead.id === selectedLeadId}
              currentUser={currentUser}
              existingChains={existingChains}
              onSelect={onLeadSelect}
              onLocate={onLocate}
              onAssignChain={onAssignChain}
              onClaim={onClaim}
            />
          ) : (
            <div key={item.group.name}>
              <ChainRow
                group={item.group}
                expanded={expandedChains.has(item.group.name)}
                onToggle={() => toggleChain(item.group.name)}
              />
              {expandedChains.has(item.group.name) && (
                <div className="bg-gray-50/60 dark:bg-black/20">
                  {item.group.leads.map((lead) => (
                    <StoreRow
                      key={lead.id}
                      lead={lead}
                      selected={lead.id === selectedLeadId}
                      currentUser={currentUser}
                      existingChains={existingChains}
                      onSelect={onLeadSelect}
                      onLocate={onLocate}
                      onAssignChain={onAssignChain}
                      onClaim={onClaim}
                      displayName={lead.store_name !== item.group.name ? lead.store_name : (lead.address ?? lead.store_name)}
                      indent
                    />
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </aside>
  );
}

function ChainRow({ group, expanded, onToggle }: { group: ChainGroup; expanded: boolean; onToggle: () => void }) {
  const statuses = Array.from(new Set(group.leads.map((l) => l.status)));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className="w-full text-left p-3 flex items-center gap-2 cursor-pointer transition-colors border-l-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
      <div className="flex -space-x-1 shrink-0">
        {statuses.slice(0, 4).map((s: Status) => (
          <span
            key={s}
            className="w-2.5 h-2.5 rounded-full border border-white dark:border-gray-900"
            style={{ background: STATUS_COLORS[s] }}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{group.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{group.leads.length} locations</p>
      </div>
    </div>
  );
}

function StoreRow({
  lead,
  selected,
  currentUser,
  existingChains,
  onSelect,
  onLocate,
  onAssignChain,
  onClaim,
  displayName,
  indent,
}: {
  lead: Lead;
  selected: boolean;
  currentUser: Profile;
  existingChains: string[];
  onSelect: (lead: Lead) => void;
  onLocate: (lead: Lead) => void;
  onAssignChain: (lead: Lead, chainGroup: string | null) => void;
  onClaim: (lead: Lead) => void;
  displayName?: string;
  indent?: boolean;
}) {
  const [assigning, setAssigning] = useState(false);
  const locatable = lead.lat !== null && lead.lng !== null;
  const canEdit = currentUser.role === 'admin' || lead.sales_associate_id === currentUser.id;
  const name = displayName ?? lead.store_name;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(lead)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(lead);
        }
      }}
      className={`w-full text-left p-3 flex items-start gap-2 cursor-pointer transition-colors ${indent ? 'pl-8' : ''} ${
        selected
          ? 'bg-teal-50 dark:bg-teal-900/30 border-l-2 border-teal-600'
          : 'border-l-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <span
        className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: STATUS_COLORS[lead.status] }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {name}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {[lead.neighborhood, lead.store_type ? STORE_TYPE_LABELS[lead.store_type] : null]
            .filter(Boolean)
            .join(' · ') || '—'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {STATUS_LABELS[lead.status]}
          </span>
          {lead.profiles?.name && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
              · {lead.profiles.name}
              {lead.profiles.labels && lead.profiles.labels.length > 0 && ` (${lead.profiles.labels.join(', ')})`}
            </span>
          )}
          {lead.chain_group && (
            <span className="text-[11px] text-teal-600 dark:text-teal-400 truncate">
              · in {lead.chain_group}
            </span>
          )}
        </div>

        {lead.sales_associate_id === null && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClaim(lead);
            }}
            className="mt-1.5 text-[11px] px-2 py-1 rounded-md bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/40 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-400 font-medium transition-colors"
          >
            Claim
          </button>
        )}

        {assigning && canEdit && (
          <ChainAssignForm
            lead={lead}
            existingChains={existingChains}
            onAssign={(chainGroup) => {
              onAssignChain(lead, chainGroup);
              setAssigning(false);
            }}
            onCancel={() => setAssigning(false)}
          />
        )}
      </div>

      {canEdit && (
        <button
          type="button"
          title={lead.chain_group ? 'Change chain group' : 'Add to a chain group'}
          onClick={(e) => {
            e.stopPropagation();
            setAssigning((v) => !v);
          }}
          className={`shrink-0 mt-0.5 p-1.5 rounded-md transition-colors ${
            assigning
              ? 'text-teal-600 bg-teal-50 dark:bg-teal-900/40 dark:text-teal-400'
              : 'text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/40 dark:hover:text-teal-400'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      )}

      <button
        type="button"
        title={locatable ? 'Jump to location on map' : 'No coordinates for this store'}
        disabled={!locatable}
        onClick={(e) => {
          e.stopPropagation();
          onLocate(lead);
        }}
        className="shrink-0 mt-0.5 p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/40 dark:hover:text-teal-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.94 11A9 9 0 1 1 13 3.06" />
          <path d="M20.94 11H15v6" />
          <path d="M15 3l6 6" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );
}

function ChainAssignForm({
  lead,
  existingChains,
  onAssign,
  onCancel,
}: {
  lead: Lead;
  existingChains: string[];
  onAssign: (chainGroup: string | null) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(lead.chain_group ?? '');
  const datalistId = `chain-options-${lead.id}`;

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed) onAssign(trimmed);
  };

  return (
    <div onClick={(e) => e.stopPropagation()} className="mt-2 flex items-center gap-1.5">
      <input
        autoFocus
        list={datalistId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Chain name…"
        className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <datalist id={datalistId}>
        {existingChains.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={submit}
        disabled={!draft.trim()}
        className="shrink-0 text-[11px] px-2 py-1 rounded-md bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-medium transition-colors"
      >
        Save
      </button>
      {lead.chain_group && (
        <button
          type="button"
          onClick={() => onAssign(null)}
          className="shrink-0 text-[11px] px-2 py-1 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 text-red-600 dark:text-red-400 font-medium transition-colors"
        >
          Remove
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
