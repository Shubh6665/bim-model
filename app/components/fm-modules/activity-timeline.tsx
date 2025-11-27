"use client";

import React, { useState, useEffect } from "react";

interface ActivityLogEntry {
  _id: string;
  action: string;
  author: string;
  authorRole: string;
  timestamp: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
}

interface ActivityTimelineProps {
  projectId: string;
  workOrderId?: string;
  ticketId?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ projectId, workOrderId, ticketId }) => {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [projectId, workOrderId, ticketId]);

  const fetchActivities = async () => {
    if (!projectId || (!workOrderId && !ticketId)) return;
    
    setLoading(true);
    try {
      const entityType = workOrderId ? 'work-order' : 'ticket';
      const entityId = workOrderId || ticketId;
      const res = await fetch(`/api/projects/${projectId}/activity-logs?${entityType}Id=${entityId}`);
      
      if (res.ok) {
        const data = await res.json();
        setActivities(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'TICKET_CREATED':
      case 'WORK_ORDER_CREATED':
        return '🎫';
      case 'TICKET_APPROVED':
        return '✅';
      case 'TICKET_REJECTED':
        return '❌';
      case 'STATUS_CHANGED':
        return '🔄';
      case 'PRIORITY_CHANGED':
      case 'TYPE_CHANGED':
        return '⚙️';
      case 'TM_RESOLVED':
        return '🏁';
      case 'FM_INTEGRATION_REQUESTED':
        return '🔁';
      case 'TECHNICIAN_ASSIGNED':
        return '👤';
      case 'TECHNICIAN_REMOVED':
        return '👤❌';
      default:
        return '📝';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'TM':
        return 'text-blue-400';
      case 'FM':
        return 'text-purple-400';
      case 'Maintainer':
        return 'text-green-400';
      case 'User':
        return 'text-gray-400';
      default:
        return 'text-white';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="text-gray-400 text-sm">Loading activity timeline...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors"
      >
        <h3 className="text-lg font-semibold text-white">Activity Timeline</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{activities.length} events</span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 max-h-96 overflow-y-auto">
          {activities.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              No activities recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={activity._id || index} className="flex gap-3 pb-3 border-b border-gray-700 last:border-0">
                  <div className="text-2xl flex-shrink-0">{getActionIcon(activity.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${getRoleColor(activity.authorRole)}`}>
                          {activity.authorRole}
                        </span>
                        <span className="text-gray-500 text-xs">•</span>
                        <span className="text-gray-400 text-xs truncate">{activity.author}</span>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(activity.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-300">
                      {activity.action.replace(/_/g, ' ')}
                    </div>
                    
                    {activity.fieldChanged && (
                      <div className="mt-1 text-xs">
                        <span className="text-gray-500">Field: </span>
                        <span className="text-gray-300 font-medium">{activity.fieldChanged}</span>
                      </div>
                    )}
                    
                    {(activity.oldValue || activity.newValue) && (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        {activity.oldValue && (
                          <span className="px-2 py-1 bg-red-900/30 text-red-300 rounded">
                            {activity.oldValue}
                          </span>
                        )}
                        {activity.oldValue && activity.newValue && (
                          <span className="text-gray-500">→</span>
                        )}
                        {activity.newValue && (
                          <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded">
                            {activity.newValue}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {activity.notes && (
                      <div className="mt-2 text-xs text-gray-400 bg-gray-900/50 rounded px-2 py-1">
                        {activity.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
