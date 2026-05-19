"use client";

import React, { useState } from "react";
import {
  Search,
  Filter,
  MoreVertical,
  Video,
  Camera,
  Map,
  ArrowLeft
} from "lucide-react";

interface VTPanelProps {
  onBack: () => void;
}

export function VTPanel({ onBack }: VTPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'tours' | 'cameras'>('tours');

  return (
    <div className="flex flex-col h-full bg-card/80 backdrop-blur-xl backdrop-saturate-150 border-l border-border/60 shadow-[-12px_0_30px_-12px_rgba(15,20,28,0.25)] text-foreground w-80 relative z-10">
      {/* Header */}
      <div className="p-4 border-b border-border/60 bg-foreground/[0.02]">
        <div className="flex items-center justify-center relative mb-4">
          <button 
            onClick={onBack}
            className="absolute left-0 p-1.5 hover:bg-accent rounded-full transition-all duration-300"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <h2 className="text-lg font-semibold tracking-wide">VT</h2>
        </div>


        {/* Search */}
        <div className="relative mt-4 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
          <input
            type="text"
            placeholder="Search VT items..."
            className="w-full bg-background/40 border border-border/10 rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/5">
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all duration-300 ${
            activeTab === 'tours'
              ? 'border-blue-400 text-blue-300'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('tours')}
        >
          Virtual Tours
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all duration-300 ${
            activeTab === 'cameras'
              ? 'border-blue-400 text-blue-300'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('cameras')}
        >
          Cameras
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Content removed as requested */}
      </div>
    </div>
  );
}
