'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  Lead, Profile, Filters, Status, StoreType,
  STATUS_LABELS, STATUS_COLORS, STORE_TYPE_LABELS, cityLabel,
} from '@/components/types';
import FilterBar from '@/components/FilterBar';
import LeadPanel from '@/components/LeadPanel';
import AddLeadModal from '@/components/AddLeadModal';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import StoreList from '@/components/StoreList';
import ThemeToggle from '@/components/ThemeToggle';
import type { FlyToTarget } from '@/components/MapView';

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
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showStoreList, setShowStoreList] = useState(true);
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget | null>(null);
  const [filters, setFilters] = useState<Filters>({
    city: 'all',
    statuses: [],
    storeTypes: [],
    associateId: '',
    neighborhood: '',
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
      if (filters.neighborhood && lead.neighborhood !== filters.neighborhood) return false;
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

  const handleLocate = (lead: Lead) => {
    setSelectedLead(lead);
    if (lead.lat !== null && lead.lng !== null) {
      setFlyToTarget({ lat: lead.lat, lng: lead.lng, ts: Date.now() });
    }
  };

  const handleAssignChain = async (lead: Lead, chainGroup: string | null) => {
    const { data, error } = await supabase
      .from('leads')
      .update({ chain_group: chainGroup })
      .eq('id', lead.id)
      .select('*, profiles!sales_associate_id(id, name, role)')
      .single();

    if (!error && data) {
      setLeads((prev) => prev.map((l) => (l.id === data.id ? (data as Lead) : l)));
    } else if (error) {
      console.error('Failed to update chain group:', error.message);
    }
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
      cityLabel(l.city),
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
    leads.forEach((l) => counts[l.status]++);
    return counts;
  }, [leads]);

  return (
    <div className="h-full flex flex-col">
      {/* Navbar */}
      <nav className="h-12 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 flex items-center px-4 gap-4 shrink-0 z-20">
        <span className="font-extrabold text-teal-700 dark:text-teal-400 text-sm tracking-[-0.02em]">Posana Sales</span>

        {/* Status summary pills */}
        <div className="hidden md:flex items-center gap-2 flex-1 overflow-x-auto">
          {(Object.entries(statusCounts) as [Status, number][]).map(([s, count]) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap shrink-0"
              style={{ background: STATUS_COLORS[s] }}
            >
              {count} {STATUS_LABELS[s]}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setShowStoreList((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showStoreList
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            Stores
          </button>
          <button
            onClick={exportCSV}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
          >
            CSV
          </button>
          <button
            onClick={exportKML}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
          >
            KML
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setShowAdmin((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                showAdmin
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              Admin
            </button>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{currentUser.name}</span>
          <button
            onClick={() => setShowChangePassword(true)}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
          >
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
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

        {/* Store list */}
        {!loading && showStoreList && (
          <StoreList
            leads={filteredLeads}
            selectedLeadId={selectedLead?.id}
            currentUser={currentUser}
            onLeadSelect={setSelectedLead}
            onLocate={handleLocate}
            onAssignChain={handleAssignChain}
          />
        )}

        {/* Map area */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              Loading leads...
            </div>
          ) : (
            <MapView
              leads={filteredLeads}
              selectedLeadId={selectedLead?.id}
              city={filters.city}
              onLeadSelect={setSelectedLead}
              flyToTarget={flyToTarget}
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

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
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

  const [emails, setEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/admin/members')
      .then((r) => r.json())
      .then((data) => {
        if (data.emails) {
          setEmails(Object.fromEntries(data.emails.map((e: { id: string; email: string }) => [e.id, e.email])));
        }
      })
      .catch(() => {});
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Profile['role']>('associate');
  const [editEmail, setEditEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState('');

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditRole(p.role);
    setEditEmail(emails[p.id] ?? '');
    setEditMsg('');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    setEditMsg('');

    const { error } = await supabase
      .from('profiles')
      .update({ name: editName, role: editRole })
      .eq('id', id);

    if (error) {
      setSavingEdit(false);
      setEditMsg('Error: ' + error.message);
      return;
    }

    if (editEmail !== emails[id]) {
      const res = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email: editEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSavingEdit(false);
        setEditMsg('Error: ' + data.error);
        return;
      }
      setEmails((prev) => ({ ...prev, [id]: data.email }));
    }

    setSavingEdit(false);
    setEditingId(null);
    onRefresh();
  };

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
    <aside className="w-72 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-700 flex flex-col overflow-y-auto shrink-0">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Admin Panel</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{profiles.length} team members</p>
      </div>

      {/* Team list */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Team</p>
        {editMsg && (
          <p className="text-xs mb-2 p-2 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400">
            {editMsg}
          </p>
        )}
        <div className="space-y-2">
          {profiles.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="p-2 rounded-lg border border-teal-200 dark:border-gray-600 space-y-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Name"
                />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Email"
                />
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Profile['role'])}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="associate">Associate</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(p.id)}
                    disabled={savingEdit || !editName}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                  >
                    {savingEdit ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{p.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{emails[p.id] ?? '—'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{p.role}</p>
                </div>
                <button
                  onClick={() => startEdit(p)}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Edit
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Invite */}
      <div className="p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Add Team Member</p>
        {msg && (
          <p className={`text-xs mb-3 p-2 rounded ${msg.startsWith('Error') ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400' : 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400'}`}>
            {msg}
          </p>
        )}
        <form onSubmit={handleInvite} className="space-y-2">
          <input
            required
            placeholder="Full name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            required
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            required
            type="password"
            placeholder="Temporary password"
            value={invitePassword}
            onChange={(e) => setInvitePassword(e.target.value)}
            minLength={6}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
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
