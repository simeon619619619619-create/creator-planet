import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: 'green' | 'amber' | 'red' | 'blue' | 'default';
}

const colorMap = {
  green: 'text-[#16A34A]',
  amber: 'text-[#F59E0B]',
  red: 'text-[#DC2626]',
  blue: 'text-[#2563EB]',
  default: 'text-[#FAFAFA]',
};

const bgColorMap = {
  green: 'bg-[#16A34A]/10',
  amber: 'bg-[#F59E0B]/10',
  red: 'bg-[#DC2626]/10',
  blue: 'bg-[#2563EB]/10',
  default: 'bg-[#1F1F1F]',
};

const AdminStatCard: React.FC<AdminStatCardProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  color = 'default',
}) => {
  return (
    <div className="bg-[#0A0A0A] p-5 rounded-xl border border-[#1F1F1F] hover:border-[#333333] transition-colors">
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#A0A0A0] uppercase tracking-wider">{label}</p>
          <h3 className="text-2xl font-bold text-[#FAFAFA] mt-2">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-lg ${bgColorMap[color]} shrink-0 ml-3`}>
          <Icon size={20} className={colorMap[color]} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center text-sm">
          <span className={`font-medium ${trend.positive ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        </div>
      )}
    </div>
  );
};

export default AdminStatCard;
