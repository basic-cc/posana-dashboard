'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Profile } from './types';

interface Props {
  currentUser: Profile;
  onClose: () => void;
  onSaved: (labels: string[]) => void;
}

export default function LabelsEditor({ currentUser, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [labels, setLabels] = useState<string[]>(currentUser.labels ?? []);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLabel = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (labels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    setLabels((prev) => [...prev, trimmed]);
    setDraft('');
  };

  const removeLabel = (label: string) => {
    setLabels((prev) => prev.filter((l) => l !== label));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ labels })
      .eq('id', currentUser.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onSaved(labels);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">My Labels</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tag the areas you&apos;re targeting so teammates can see where you&apos;re working.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none shrink-0 ml-2">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <p className="text-xs p-2 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex flex-wrap gap-1.5 min-h-[1.75rem]">
            {labels.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">No labels yet.</p>
            )}
            {labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400"
              >
                {label}
                <button
                  type="button"
                  onClick={() => removeLabel(label)}
                  className="text-teal-400 hover:text-teal-700 dark:hover:text-teal-200 leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLabel();
                }
              }}
              placeholder="e.g. Brooklyn gyms"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="button"
              onClick={addLabel}
              disabled={!draft.trim()}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
            >
              Add
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-2 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
