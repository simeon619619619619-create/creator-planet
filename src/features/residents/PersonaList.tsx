import React from 'react';
import { Persona } from './residentsService';
import PersonaCard from './PersonaCard';

interface PersonaListProps {
  personas: Persona[];
  onChange: (updated: Persona) => void;
}

const PersonaList: React.FC<PersonaListProps> = ({ personas, onChange }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {personas.map((p) => (
      <PersonaCard key={p.id} persona={p} onChange={onChange} />
    ))}
  </div>
);

export default PersonaList;
