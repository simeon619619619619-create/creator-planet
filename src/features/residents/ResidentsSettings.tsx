import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, Power, AlertTriangle, Plus } from 'lucide-react';
import {
  Persona,
  ScheduleConfig,
  ActivityLogRow,
  UsageSummary,
  getPersonas,
  ensureScheduleConfig,
  setMasterEnabled,
  setManualNotes,
  getRecentActivity,
  getUsageSummary,
  bootstrapNewbie,
} from './residentsService';
import AddPersonaModal from './AddPersonaModal';

interface ResidentsSettingsProps {
  communityId: string;
}

const ResidentsSettings: React.FC<ResidentsSettingsProps> = ({ communityId }) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [usage, setUsage] = useState<UsageSummary>({
    total_actions: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost_usd: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaved, setNotesSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [bootstrapResult, setBootstrapResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const refreshAll = async () => {
    const [p, a, u] = await Promise.all([
      getPersonas(communityId),
      getRecentActivity(communityId, 15),
      getUsageSummary(communityId, 30),
    ]);
    setPersonas(p);
    setActivity(a);
    setUsage(u);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      const [p, c, a, u] = await Promise.all([
        getPersonas(communityId),
        ensureScheduleConfig(communityId),
        getRecentActivity(communityId, 15),
        getUsageSummary(communityId, 30),
      ]);
      if (cancelled) return;
      setPersonas(p);
      setConfig(c);
      setActivity(a);
      setUsage(u);
      setNotesDraft(c?.manual_notes ?? '');
      setIsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const handleMasterToggle = async () => {
    if (!config) return;
    setBusyKey('master');
    const next = !config.master_enabled;
    const ok = await setMasterEnabled(communityId, next);
    if (ok) setConfig({ ...config, master_enabled: next });
    setBusyKey(null);
  };

  const handleSaveNotes = async () => {
    setNotesSaved('saving');
    await setManualNotes(communityId, notesDraft);
    setNotesSaved('saved');
    setTimeout(() => setNotesSaved('idle'), 1500);
  };

  const handleBootstrapNewbie = async () => {
    setBusyKey('bootstrap');
    setBootstrapResult(null);
    const result = await bootstrapNewbie(communityId);
    if (result.ok) {
      setBootstrapResult({
        ok: true,
        msg: result.postPreview ? `Постнато: "${result.postPreview.slice(0, 100)}..."` : 'Постнато успешно.',
      });
      const [p, a, u] = await Promise.all([
        getPersonas(communityId),
        getRecentActivity(communityId, 15),
        getUsageSummary(communityId, 30),
      ]);
      setPersonas(p);
      setActivity(a);
      setUsage(u);
    } else {
      setBootstrapResult({ ok: false, msg: result.error ?? 'Неуспешно.' });
    }
    setBusyKey(null);
  };

  const updatePersona = (updated: Persona) => {
    setPersonas((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#666]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#FAFAFA] mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Резиденти
        </h2>
        <p className="text-[#A0A0A0] text-sm">
          AI участници, които пишат в общността като реални хора. Управляват се само от теб като създател.
        </p>
      </div>

      {/* Master control */}
      <div className="bg-[#0A0A0A] rounded-lg p-5 border border-[#1F1F1F]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Power
              className={`w-5 h-5 mt-0.5 ${config?.master_enabled ? 'text-emerald-400' : 'text-[#444]'}`}
            />
            <div>
              <h3 className="text-[#FAFAFA] font-medium">Активирай Резидентите</h3>
              <p className="text-xs text-[#A0A0A0] mt-1">
                Когато е изключено, никой персона не пише — без значение от индивидуалните настройки.
              </p>
            </div>
          </div>
          <button
            onClick={handleMasterToggle}
            disabled={busyKey === 'master'}
            className={`text-sm font-medium px-4 py-2 rounded-md transition-colors ${
              config?.master_enabled
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                : 'bg-[#1F1F1F] text-[#A0A0A0] hover:bg-[#2A2A2A] border border-[#1F1F1F]'
            } disabled:opacity-50`}
          >
            {busyKey === 'master' ? '...' : config?.master_enabled ? 'Включено' : 'Изключено'}
          </button>
        </div>
      </div>

      {/* Personas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[#FAFAFA] font-medium">Персони ({personas.length}/7)</h3>
          {personas.length < 7 && (
            <button
              onClick={() => setShowAddModal(true)}
              disabled={busyKey === 'bootstrap'}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#FAFAFA] text-[#0A0A0A] hover:bg-[#E0E0E0] disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Добави Резидент
            </button>
          )}
        </div>

        {bootstrapResult && (
          <div
            className={`mb-3 text-sm p-3 rounded-md border ${
              bootstrapResult.ok
                ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30'
                : 'bg-red-500/10 text-red-200 border-red-500/30'
            }`}
          >
            {bootstrapResult.msg}
          </div>
        )}

        {personas.length === 0 ? (
          <div className="bg-[#0A0A0A] rounded-lg p-8 border border-dashed border-[#1F1F1F] text-center">
            <p className="text-[#A0A0A0] text-sm">
              Няма активни Резиденти. Натисни „Започни с Новакът" за първия пост.
            </p>
          </div>
        ) : (
          <PersonaList personas={personas} onChange={updatePersona} />
        )}
      </div>

      {/* Manual notes */}
      <div className="bg-[#0A0A0A] rounded-lg p-5 border border-[#1F1F1F]">
        <h3 className="text-[#FAFAFA] font-medium mb-2">Бележки за Резидентите</h3>
        <p className="text-xs text-[#A0A0A0] mb-3">
          Свободен текст който ще бъде подаден на всеки персона като инструкция. Override на курсовото съдържание.
        </p>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="Например: „Това е общност за майки в декрет. Не споменавай корпоративен жаргон."
          className="w-full bg-[#000] border border-[#1F1F1F] rounded-md p-3 text-sm text-[#FAFAFA] placeholder:text-[#444] focus:outline-none focus:border-[#444] min-h-[100px]"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#666]">
            {notesSaved === 'saved' && 'Запазено'}
            {notesSaved === 'saving' && 'Запазвам...'}
          </span>
          <button
            onClick={handleSaveNotes}
            disabled={notesSaved === 'saving'}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#1F1F1F] text-[#FAFAFA] hover:bg-[#2A2A2A] disabled:opacity-50"
          >
            Запази
          </button>
        </div>
      </div>

      {/* Usage */}
      <div className="bg-[#0A0A0A] rounded-lg p-5 border border-[#1F1F1F]">
        <h3 className="text-[#FAFAFA] font-medium mb-3">Разход (последните 30 дни)</h3>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Действия" value={usage.total_actions.toString()} />
          <Stat label="Токени" value={(usage.total_input_tokens + usage.total_output_tokens).toLocaleString()} />
          <Stat label="Цена" value={`$${usage.total_cost_usd.toFixed(4)}`} />
        </div>
      </div>

      {/* Activity log */}
      <div className="bg-[#0A0A0A] rounded-lg p-5 border border-[#1F1F1F]">
        <h3 className="text-[#FAFAFA] font-medium mb-3">Дневник (последни 15)</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-[#666]">Все още няма активност.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 border-b border-[#0F0F0F] pb-2 last:border-b-0">
                <span className="text-[11px] text-[#555] tabular-nums shrink-0">
                  {new Date(a.created_at).toLocaleString('bg-BG', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-[#A0A0A0] truncate">
                  <span className="text-[#FAFAFA] font-medium">{a.persona_name ?? '?'}</span>{' '}
                  {a.action_type === 'post' && '→ нов пост'}
                  {a.action_type === 'comment' && '→ коментар'}
                  {a.action_type === 'tick_skipped' && '→ пропусна (rate limit)'}
                  {a.action_type === 'tick_decision' && '→ реши да не пише'}
                  {a.action_type === 'avatar_generated' && '→ генерира аватар'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Disclosure warning */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/90 leading-relaxed">
          Резидентите се представят като реални членове на общността. Това трябва да е оповестено в Условията за ползване
          на платформата ти. Не публикувай и не препоръчвай продукти/услуги чрез тях.
        </p>
      </div>

      {showAddModal && (
        <AddPersonaModal
          communityId={communityId}
          existingArchetypes={personas.map((p) => p.archetype)}
          onClose={() => setShowAddModal(false)}
          onCreated={refreshAll}
        />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-[#555]">{label}</p>
    <p className="text-lg font-semibold text-[#FAFAFA] mt-1 tabular-nums">{value}</p>
  </div>
);

const PersonaList = React.lazy(() => import('./PersonaList'));

export default ResidentsSettings;
