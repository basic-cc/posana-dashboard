'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Lead, Profile, Status, StoreType, ChainType, CITY_META,
  STATUS_LABELS, STORE_TYPE_LABELS,
} from './types';

const ALL_STATUSES: Status[] = ['not_contacted', 'in_contact', 'samples_shipped', 'actively_selling', 'declined'];
const ALL_STORE_TYPES: StoreType[] = ['coffee_shop', 'gym_fitness', 'smoothie_shop', 'local_deli', 'specialty_grocer', 'other'];
const ALL_CHAIN_TYPES: ChainType[] = ['local', 'corporate_chain'];

const COLUMNS = [
  'store_name',
  'address',
  'city',
  'neighborhood',
  'store_type',
  'chain_type',
  'contact_name',
  'contact_phone',
  'contact_email',
  'status',
  'notes',
] as const;

interface Props {
  profiles: Profile[];
  currentUser: Profile;
  onImported: (leads: Lead[]) => void;
  onClose: () => void;
}

interface ParsedRow {
  store_name: string;
  address: string;
  city: string;
  neighborhood: string;
  store_type: StoreType | null;
  chain_type: ChainType | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  status: Status;
  notes: string;
  warnings: string[];
}

function buildImportPrompt(): string {
  const cityList = Object.values(CITY_META)
    .filter((m) => m.lat !== null)
    .map((m) => m.label)
    .join(', ');

  return `You are converting raw, messy store/lead data into a strict CSV format for import into the Posana Sales CRM.

Output ONLY a CSV block — a header row followed by one row per store. No commentary, no markdown code fences, no extra columns. Use double quotes around any field containing a comma. Leave a field blank (empty string) if unknown — never write "N/A" or "unknown".

Header row (exact column names, this order):
${COLUMNS.join(',')}

Column rules:
- store_name: required, the business name.
- address: full street address if available.
- city: known cities are: ${cityList}. If the store is in one of these, output that name EXACTLY as spelled here — same capitalization, no state abbreviation, no extra punctuation (e.g. write "NYC", never "NYC (NY)" or "NYC, NY" or "New York City"). Only write a different city name if the store genuinely isn't in any of these.
- neighborhood: neighborhood/area name if known, else blank.
- store_type: one of exactly: ${ALL_STORE_TYPES.join(', ')} (leave blank if unclear).
- chain_type: one of exactly: ${ALL_CHAIN_TYPES.join(', ')} (leave blank if unclear).
- contact_name, contact_phone, contact_email: point-of-contact details if present in the source data.
- status: one of exactly: ${ALL_STATUSES.join(', ')} (default to not_contacted if unknown).
- notes: any other relevant context worth keeping, one line (no newlines).

Now convert the following raw data into that CSV format:

<PASTE YOUR RAW DATA HERE>`;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const KNOWN_STATE_CODES = Array.from(
  new Set(Object.values(CITY_META).map((m) => m.state).filter((s) => /^[A-Z]{2}$/.test(s)))
);
// Matches a trailing state qualifier like " (NY)", ", NY", or "-NY" so
// "NYC (NY)" / "NYC, NY" / "NYC-NY" all resolve the same as plain "NYC"
// instead of being slugified into a brand new, duplicate city.
const TRAILING_STATE_RE = new RegExp(`[\\s,(-]+(${KNOWN_STATE_CODES.join('|')})\\)?$`, 'i');

function matchCitySlug(value: string): string | null {
  const lower = value.trim().toLowerCase();
  if (!lower) return null;
  if (CITY_META[lower]) return lower;
  const match = Object.entries(CITY_META).find(([, meta]) => meta.label.toLowerCase() === lower);
  return match ? match[0] : null;
}

function resolveCitySlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'unknown';

  const direct = matchCitySlug(trimmed);
  if (direct) return direct;

  const withoutState = matchCitySlug(trimmed.replace(TRAILING_STATE_RE, ''));
  if (withoutState) return withoutState;

  return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'unknown';
}

function parseRows(text: string): ParsedRow[] {
  const raw = parseCSV(text);
  if (raw.length === 0) return [];

  const header = raw[0].map((h) => h.trim().toLowerCase());
  const colIndex = (name: string) => header.indexOf(name);

  return raw.slice(1).map((cells) => {
    const get = (name: string) => {
      const idx = colIndex(name);
      return idx >= 0 ? (cells[idx] ?? '').trim() : '';
    };

    const warnings: string[] = [];

    const storeTypeRaw = get('store_type').toLowerCase().replace(/\s+/g, '_');
    const storeType = ALL_STORE_TYPES.includes(storeTypeRaw as StoreType) ? (storeTypeRaw as StoreType) : null;
    if (get('store_type') && !storeType) warnings.push(`unrecognized store_type "${get('store_type')}"`);

    const chainTypeRaw = get('chain_type').toLowerCase().replace(/\s+/g, '_');
    const chainType = ALL_CHAIN_TYPES.includes(chainTypeRaw as ChainType) ? (chainTypeRaw as ChainType) : null;
    if (get('chain_type') && !chainType) warnings.push(`unrecognized chain_type "${get('chain_type')}"`);

    const statusRaw = get('status').toLowerCase().replace(/\s+/g, '_');
    const status = ALL_STATUSES.includes(statusRaw as Status) ? (statusRaw as Status) : 'not_contacted';
    if (get('status') && status === 'not_contacted' && statusRaw !== 'not_contacted') {
      warnings.push(`unrecognized status "${get('status')}", defaulted to Not Contacted`);
    }

    if (!get('store_name')) warnings.push('missing store_name');

    return {
      store_name: get('store_name'),
      address: get('address'),
      city: resolveCitySlug(get('city')),
      neighborhood: get('neighborhood'),
      store_type: storeType,
      chain_type: chainType,
      contact_name: get('contact_name'),
      contact_phone: get('contact_phone'),
      contact_email: get('contact_email'),
      status,
      notes: get('notes'),
      warnings,
    };
  });
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ImportModal({ profiles, currentUser, onImported, onClose }: Props) {
  const supabase = createClient();
  const [csvText, setCsvText] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>(currentUser.id);
  const [geocode, setGeocode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ imported: number; error?: string } | null>(null);

  const prompt = useMemo(() => buildImportPrompt(), []);

  const parsed = useMemo(() => parseRows(csvText), [csvText]);
  const validRows = parsed.filter((r) => r.store_name);
  const invalidCount = parsed.length - validRows.length;

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setResult(null);
    setProgress({ done: 0, total: validRows.length });

    const payloads: Record<string, unknown>[] = [];
    for (const row of validRows) {
      let lat: number | null = null;
      let lng: number | null = null;
      if (geocode && row.address) {
        const coords = await geocodeAddress(`${row.address}, ${row.city}`);
        if (coords) [lat, lng] = coords;
        await sleep(1100); // respect Nominatim's ~1 req/sec usage policy
      }
      payloads.push({
        store_name: row.store_name,
        address: row.address || null,
        lat,
        lng,
        city: row.city,
        neighborhood: row.neighborhood || null,
        store_type: row.store_type,
        chain_type: row.chain_type,
        contact_name: row.contact_name || null,
        contact_phone: row.contact_phone || null,
        contact_email: row.contact_email || null,
        status: row.status,
        notes: row.notes || null,
        sales_associate_id: assigneeId || null,
      });
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    const { data, error } = await supabase
      .from('leads')
      .insert(payloads)
      .select('*, profiles!sales_associate_id(id, name, role, labels)');

    setImporting(false);
    setProgress(null);

    if (error) {
      setResult({ imported: 0, error: error.message });
      return;
    }

    setResult({ imported: data?.length ?? 0 });
    if (data) onImported(data as Lead[]);
    setCsvText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Import Leads</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Copy the prompt below, paste it into your LLM along with the raw data, then paste the CSV it returns.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none shrink-0 ml-2">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step 1: prompt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Step 1 — Copy the import prompt
              </label>
              <button
                type="button"
                onClick={copyPrompt}
                className="text-xs px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors"
              >
                {copied ? 'Copied ✓' : 'Copy Prompt'}
              </button>
            </div>
            <textarea
              readOnly
              value={prompt}
              rows={5}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 resize-none focus:outline-none"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Paste this into ChatGPT/Claude/etc. along with your raw list of stores (spreadsheet, notes, whatever) — it will always return the same column format.
            </p>
          </div>

          {/* Step 2: paste result */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
              Step 2 — Paste the CSV the LLM returned
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder={`${COLUMNS.join(',')}\nBlue Bottle Coffee,123 Main St,New York,Tribeca,coffee_shop,corporate_chain,,,,not_contacted,`}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {csvText.trim() && (
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                {validRows.length} row{validRows.length === 1 ? '' : 's'} ready to import
                {invalidCount > 0 && <span className="text-red-500"> · {invalidCount} skipped (missing store name)</span>}
              </p>
            )}
          </div>

          {/* Step 3: options */}
          {validRows.length > 0 && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                  Assign to
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Leave unassigned</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === currentUser.id ? `${p.name} (me)` : p.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" checked={geocode} onChange={(e) => setGeocode(e.target.checked)} className="pn-checkbox" />
                <span className="text-xs text-gray-600 dark:text-gray-300">Look up map coordinates (slower, ~1 sec/row)</span>
              </label>
            </div>
          )}

          {/* Row warnings preview */}
          {validRows.some((r) => r.warnings.length > 0) && (
            <div className="text-xs p-2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 space-y-0.5 max-h-24 overflow-y-auto">
              {validRows
                .filter((r) => r.warnings.length > 0)
                .slice(0, 10)
                .map((r, i) => (
                  <p key={i}>
                    {r.store_name}: {r.warnings.join(', ')}
                  </p>
                ))}
            </div>
          )}

          {progress && (
            <p className="text-xs text-teal-600 dark:text-teal-400">
              Importing {progress.done}/{progress.total}…
            </p>
          )}

          {result && (
            <p
              className={`text-xs p-2 rounded ${
                result.error
                  ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
                  : 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400'
              }`}
            >
              {result.error ? `Error: ${result.error}` : `Imported ${result.imported} lead${result.imported === 1 ? '' : 's'}.`}
            </p>
          )}

          {/* Format reference */}
          <details className="text-xs text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer font-medium">Column format reference</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-1 pr-3 font-semibold">Column</th>
                    <th className="py-1 font-semibold">Allowed values</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="py-1 pr-3 font-mono">store_name</td><td>required, free text</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">address</td><td>free text</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">city</td><td>{Object.values(CITY_META).filter((m) => m.lat !== null).map((m) => m.label).join(', ')}, or any other city name</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">neighborhood</td><td>free text</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">store_type</td><td>{ALL_STORE_TYPES.map((t) => `${t} (${STORE_TYPE_LABELS[t]})`).join(', ')}</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">chain_type</td><td>local, corporate_chain</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">contact_name / contact_phone / contact_email</td><td>free text</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">status</td><td>{ALL_STATUSES.map((s) => `${s} (${STATUS_LABELS[s]})`).join(', ')}</td></tr>
                  <tr><td className="py-1 pr-3 font-mono">notes</td><td>free text, single line</td></tr>
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3 shrink-0">
          <button
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {importing ? 'Importing…' : `Import ${validRows.length || ''} Lead${validRows.length === 1 ? '' : 's'}`}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-2 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
