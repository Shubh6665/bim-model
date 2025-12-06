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
    <div className="flex flex-col h-full bg-gray-900 text-white border-r border-gray-700 w-80">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-center relative mb-4">
          <button 
            onClick={onBack}
            className="absolute left-0 p-1 hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <h2 className="text-lg font-bold">VT</h2>
        </div>


        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search VT items..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tours'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('tours')}
        >
          Virtual Tours
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cameras'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-white'
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
