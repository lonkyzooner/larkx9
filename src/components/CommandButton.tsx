
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CommandButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
}

const CommandButton: React.FC<CommandButtonProps> = ({ icon: Icon, label, onClick, className = '' }) => {
  return (
    <button 
      className={`modern-button h-20 px-4 py-3 rounded-xl
        flex flex-col items-center justify-center
        bg-gradient-to-br from-[#0a1a30] to-[#051326] 
        border border-lark-light-blue/20 shadow-lg
        hover:from-[#0c2040] hover:to-[#071a33] 
        hover:border-lark-light-blue/40
        active:scale-95
        text-foreground text-sm font-medium transition-all duration-300 ${className}`} 
      onClick={onClick}
    >
      <Icon className="text-lark-light-blue text-xl mb-1" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

export default CommandButton;
