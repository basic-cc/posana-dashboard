'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  Lead, Profile, Filters, Status, StoreType,
  STATUS_LABELS, STATUS_COLORS, STORE_TYPE_LABELS,
} from '@/components/types';
import FilterBar from '@/components/FilterBar';
import LeadPanel from '@/components/LeadPanel';
import AddLeadModal from '@/components/AddLeadModal';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

interface Props {
  currentUser: Profile;
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function DashboardClient({ currentUser }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    city: 'all',
    statuses: [],
    storeTypes: [],
    associateId: '',
    search: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [leadsRes, profilesRes] = await Promise.all([
      supabase
        .from('leads')
        .select('*, profiles!sales_associate_id(id, name, role)')
        .order('store_name'),
      supabase.from('profiles').select('*').order('name'),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setLoading(false);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.city !== 'all' && lead.city !== filters.city) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(lead.status)) return false;
      if (filters.storeTypes.length > 0 && (!lead.store_type || !filters.storeTypes.includes(lead.store_type as StoreType))) return false;
      if (filters.associateId && lead.sales_associate_id !== filters.associateId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !lead.store_name.toLowerCase().includes(q) &&
          !(lead.address ?? '').toLowerCase().includes(q) &&
          !(lead.neighborhood ?? '').toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [leads, filters]);

  const handleLeadUpdated = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelectedLead(updated);
  };

  const handleLeadDeleted = (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedLead(null);
  };

  const handleLeadAdded = (lead: Lead) => {
    setLeads((prev) => [...prev, lead].sort((a, b) => a.store_name.localeCompare(b.store_name)));
    setShowAddModal(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const exportCSV = () => {
    const headers = [
      'Store Name', 'Address', 'Neighborhood', 'City', 'Status',
      'Store Type', 'Chain', 'Associate', 'Contact Name',
      'Contact Phone', 'Contact Email', 'Last Contacted', 'Notes',
    ];
    const rows = filteredLeads.map((l) => [
      l.store_name,
      l.address ?? '',
      l.neighborhood ?? '',
      l.city.toUpperCase(),
      STATUS_LABELS[l.status],
      l.store_type ? STORE_TYPE_LABELS[l.store_type as StoreType] : '',
      l.chain_type === 'local' ? 'Local' : l.chain_type === 'corporate_chain' ? 'Corporate' : '',
      l.profiles?.name ?? '',
      l.contact_name ?? '',
      l.contact_phone ?? '',
      l.contact_email ?? '',
      l.last_contacted_date ?? '',
      l.notes ?? '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'posana-leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportKML = () => {
    const placemarks = filteredLeads
      .filter((l) => l.lat !== null && l.lng !== null)
      .map(
        (l) => `
    <Placemark>
      <name>${escapeXml(l.store_name)}</name>
      <description>${escapeXml(
        [
          `Status: ${STATUS_LABELS[l.status]}`,
          l.profiles?.name ? `Associate: ${l.profiles.name}` : '',
          l.contact_name ? `Contact: ${l.contact_name}` : '',
          l.contact_phone ? `Phone: ${l.contact_phone}` : '',
          l.contact_email ? `Email: ${l.contact_email}` : '',
          l.notes ? `Notes: ${l.notes}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      )}</description>
      <Point><coordinates>${l.lng},${l.lat},0</coordinates></Point>
    </Placemark>`
      )
      .join('');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Posana Sales Leads</name>${placemarks}
  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'posana-leads.kml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<Status, number> = {
      not_contacted: 0, in_contact: 0,
      samples_shipped: 0, actively_selling: 0, declined: 0,
    };
    filteredLeads.forEach((l) => counts[l.status]++);
    return counts;
  }, [filteredLeads]);

  return (
    <div className="h-full flex flex-col">
      {/* Navbar */}
      <nav className="h-12 bg-white border-b border-gray-100 flex items-center px-4 gap-4 shrink-0 z-20">
        <span className="font-bold text-teal-700 text-sm tracking-tight">Posana Sales</span>

        {/* Status summary pills */}
        <div className="hidden md:flex items-center gap-2 flex-1">
          {(Object.entries(statusCounts) as [Status, number][]).map(([s, count]) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ background: STATUS_COLORS[s] }}
            >
              {count} {STATUS_LABELS[s].split(' ')[0]}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            CSV
          </button>
          <button
            onClick={exportKML}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            KML
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setShowAdmin((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                showAdmin
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Admin
            </button>
          )}
          <span className="text-xs text-gray-500 hidden sm:block">{currentUser.name}</span>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <FilterBar
          filters={filters}
          profiles={profiles}
          leads={leads}
          filteredCount={filteredLeads.length}
          onChange={setFilters}
        />

        {/* Map area */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Loading leads...
            </div>
          ) : (
            <MapView
              leads={filteredLeads}
              selectedLeadId={selectedLead?.id}
              city={filters.city}
              onLeadSelect={setSelectedLead}
            />
          )}

          {/* Lead panel */}
          {selectedLead && (
            <LeadPanel
              lead={selectedLead}
              profiles={profiles}
              currentUser={currentUser}
              onClose={() => setSelectedLead(null)}
              onUpdate={handleLeadUpdated}
              onDelete={handleLeadDeleted}
            />
          )}

          {/* Add lead FAB */}
          <button
            onClick={() => setShowAddModal(true)}
            className="absolute bottom-6 right-6 z-20 bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2.5 rounded-full shadow-lg text-sm transition-colors"
            style={{ zIndex: selectedLead ? 5 : 20 }}
          >
            + Add Lead
          </button>
        </div>

        {/* Admin panel */}
        {showAdmin && currentUser.role === 'admin' && (
          <AdminPanel profiles={profiles} onRefresh={fetchData} />
        )}
      </div>

      {showAddModal && (
        <AddLeadModal
          profiles={profiles}
          currentUser={currentUser}
          onAdd={handleLeadAdded}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function AdminPanel({ profiles, onRefresh }: { profiles: Profile[]; onRefresh: () => void }) {
  const supabase = createClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');

  const [inviteEmail2, setInviteEmail2] = useState(inviteEmail);
  const [inviteName2, setInviteName2] = useState(inviteName);
  const [invitePassword2, setInvitePassword2] = useState(invitePassword);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setMsg('');

    const { data, error } = await supabase.auth.signUp({
      email: inviteEmail,
      password: invitePassword,
      options: { data: { name: inviteName } },
    });

    if (error) {
      setMsg('Error: ' + error.message);
    } else {
      setMsg(`Invited ${inviteEmail}. They can now log in.`);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      onRefresh();
    }
    setInviting(false);
  };

  return (
    <aside className="w-72 bg-white border-l border-gray-100 flex flex-col overflow-y-auto shrink-0">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">Admin Panel</h3>
        <p className="text-xs text-gray-500 mt-0.5">{profiles.length} team members</p>
      </div>

      {/* Team list */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Team</p>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400 capitalize">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      <div className="p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Team Member</p>
        {msg && (
          <p className={`text-xs mb-3 p-2 rounded ${msg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}`}>
            {msg}
          </p>
        )}
        <form onSubmit={handleInvite} className="space-y-2">
          <input
            required
            placeholder="Full name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            required
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            required
            type="password"
            placeholder="Temporary password"
            value={invitePassword}
            onChange={(e) => setInvitePassword(e.target.value)}
            minLength={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={inviting}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition-colors"
          >
            {inviting ? 'Adding...' : 'Add member'}
          </button>
        </form>
      </div>
    </aside>
  );
}
