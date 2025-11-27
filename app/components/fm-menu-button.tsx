// Reusable Menu Button Component for FM Panel
import React from "react";

interface MenuButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
}

export const MenuButton: React.FC<MenuButtonProps> = ({ label, onClick, active }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
      active
        ? "bg-blue-600 text-white"
        : "text-gray-300 hover:text-white hover:bg-gray-800"
    }`}
  >
    {label}
  </button>
);
