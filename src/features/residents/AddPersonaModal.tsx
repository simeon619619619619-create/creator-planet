import React, { useState } from 'react';
import { supabase } from '../../core/supabase/client';
import { X, Loader2 } from 'lucide-react';
import type { Archetype } from './residentsService';

interface AddPersonaModalProps {
  communityId: string;
  existingArchetypes: Archetype[];
  onClose: () => void;
  onCreated: () => void;
}

const ALL_ARCHETYPES: Array<{
  id: Archetype;
  label: string;
  description: string;
}> = [
  { id: 'newbie', label: 'Новакът-съмняващ се', description: 'Задава „глупави" въпроси, които всички имат но никой не пита.' },
  { id: 'rising_star', label: 'Звездата-в-прогрес', description: 'Споделя малки победи, мотивира с конкретика.' },
  { id: 'skeptic', label: 'Скептикът-практик', description: 'Поставя реалистични въпроси, не атакува — пита.' },
  { id: 'empath', label: 'Емпатът', description: 'Първи коментира когато някой сподели нещо лично. Кратко и топло.' },
  { id: 'expert', label: 'Експерт-съсед', description: 'Има опит в съседна област, споделя ресурси без надменност.' },
  { id: 'lurker', label: 'Lurker-който-се-обажда', description: 'Тих седмици, после пуска дълъг рефлексивен пост.' },
  { id: 'connector', label: 'Връзкаджията', description: 'Тагва хора, свързва теми. Латиница, кратки изречения.' },
];

const AddPersonaModal: React.FC<AddPersonaModalProps> = ({ communityId, existingArchetypes, onClose, onCreated }) => {
  const [selected, setSelected] = useState<Archetype | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = ALL_ARCHETYPES.filter((a) => !existingArchetypes.includes(a.id));

  const handleCreate = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/residents-create`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ community_id: communityId, archetype: selected }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#1F1F1F] sticky top-0 bg-[#0A0A0A]">
          <h2 className="text-lg font-semibold text-[#FAFAFA]">Добави Резидент</h2>
          <button onClick={onClose} className="text-[#A0A0A0] hover:text-[#FAFAFA]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-[#A0A0A0]">
            Избери архетип. Името, био и аватара ще бъдат автоматично генерирани и индивидуални за общността.
          </p>

          {available.length === 0 ? (
            <p className="text-sm text-[#666] py-8 text-center">Всички 7 архетипа вече съществуват.</p>
          ) : (
            <div className="space-y-2">
              {available.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected === a.id
                      ? 'bg-[#1F1F1F] border-[#FAFAFA]'
                      : 'bg-transparent border-[#1F1F1F] hover:border-[#333]'
                  }`}
                >
                  <p className="text-[#FAFAFA] font-medium text-sm">{a.label}</p>
                  <p className="text-xs text-[#A0A0A0] mt-1">{a.description}</p>
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</p>}
        </div>

        <div className="p-5 border-t border-[#1F1F1F] flex justify-end gap-2 sticky bottom-0 bg-[#0A0A0A]">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-md text-sm text-[#A0A0A0] hover:text-[#FAFAFA] disabled:opacity-50"
          >
            Откажи
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || busy}
            className="px-4 py-2 rounded-md text-sm font-medium bg-[#FAFAFA] text-[#0A0A0A] hover:bg-[#E0E0E0] disabled:opacity-50 flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Създавам...' : 'Създай'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPersonaModal;
