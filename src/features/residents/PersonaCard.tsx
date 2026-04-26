import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import {
  Persona,
  Intensity,
  archetypeLabel,
  togglePersonaActive,
  setPersonaIntensity,
} from './residentsService';

interface PersonaCardProps {
  persona: Persona;
  onChange: (updated: Persona) => void;
}

const INTENSITY_OPTIONS: Intensity[] = ['quiet', 'normal', 'active'];
const INTENSITY_LABELS_BG: Record<Intensity, string> = {
  quiet: 'тих',
  normal: 'нормален',
  active: 'активен',
};

const PersonaCard: React.FC<PersonaCardProps> = ({ persona, onChange }) => {
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    const next = !persona.is_active;
    const ok = await togglePersonaActive(persona.id, next);
    if (ok) onChange({ ...persona, is_active: next });
    setBusy(false);
  };

  const handleIntensity = async (intensity: Intensity) => {
    if (intensity === persona.intensity) return;
    setBusy(true);
    const ok = await setPersonaIntensity(persona.id, intensity);
    if (ok) onChange({ ...persona, intensity });
    setBusy(false);
  };

  const lastAction = persona.last_action_at
    ? new Date(persona.last_action_at).toLocaleString('bg-BG', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'все още не е действал/а';

  return (
    <div className="bg-[#0A0A0A] rounded-lg p-5 border border-[#1F1F1F] flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[#FAFAFA] font-semibold truncate">{persona.display_name}</h3>
            {persona.uses_latin && (
              <span className="text-[10px] uppercase tracking-wider text-[#666666] border border-[#333] rounded px-1 py-[1px]">
                latinica
              </span>
            )}
          </div>
          <p className="text-xs text-[#A0A0A0] mt-1">{archetypeLabel(persona.archetype)}</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={busy}
          className="text-[#FAFAFA] disabled:opacity-50"
          aria-label={persona.is_active ? 'Спри' : 'Активирай'}
        >
          {busy ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : persona.is_active ? (
            <ToggleRight className="w-9 h-9 text-emerald-400" />
          ) : (
            <ToggleLeft className="w-9 h-9 text-[#444]" />
          )}
        </button>
      </div>

      <p className="text-sm text-[#C0C0C0] line-clamp-2">{persona.bio}</p>

      <div>
        <p className="text-xs text-[#666666] mb-2">Интензивност</p>
        <div className="flex gap-1">
          {INTENSITY_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => handleIntensity(opt)}
              disabled={busy}
              className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                persona.intensity === opt
                  ? 'bg-[#FAFAFA] text-[#0A0A0A] border-[#FAFAFA]'
                  : 'bg-transparent text-[#A0A0A0] border-[#1F1F1F] hover:border-[#333]'
              }`}
            >
              {INTENSITY_LABELS_BG[opt]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-[#555555] mt-1">Последно действие: {lastAction}</p>
    </div>
  );
};

export default PersonaCard;
