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
        return (
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'TICKET_APPROVED':
        return (
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'TICKET_REJECTED':
        return (
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'STATUS_CHANGE':
      case 'STATUS_CHANGED':
        return (
          <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'PRIORITY_CHANGE':
      case 'TYPE_CHANGE':
        return (
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'TM_RESOLVED':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'FM_INTEGRATION_REQUESTED':
        return (
          <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'TECHNICIAN_ASSIGNED':
        return (
          <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'FM_RESOLUTION_CONFIRMED':
        return (
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'TM':
        return 'bg-blue-900/30 text-blue-300 border-blue-800';
      case 'FM':
        return 'bg-purple-900/30 text-purple-300 border-purple-800';
      case 'Maintainer':
        return 'bg-green-900/30 text-green-300 border-green-800';
      case 'User':
        return 'bg-muted/30 text-muted-foreground border-border';
      default:
        return 'bg-card text-muted-foreground border-border';
    }
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  if (loading) {
    return (
      <div className="bg-card/50 border border-border rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-12 bg-muted/50 rounded"></div>
          <div className="h-12 bg-muted/50 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/40 border border-border rounded-xl overflow-hidden shadow-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-card/60 transition-colors bg-card/60"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Activity Timeline</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{activities.length} events recorded</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 py-6 bg-card/20">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No activities recorded yet</p>
            </div>
          ) : (
            <div className="relative pl-4 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-muted/50">
              {activities.map((activity, index) => (
                <div key={activity._id || index} className="relative pl-8 group">
                  {/* Timeline Dot */}
                  <div className="absolute left-[10px] top-1.5 w-5 h-5 rounded-full bg-card border-2 border-border flex items-center justify-center z-10 group-hover:border-blue-500 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-muted group-hover:bg-blue-400 transition-colors"></div>
                  </div>

                  {/* Content Card */}
                  <div className="bg-card/50 border border-border/50 rounded-lg p-4 hover:border-border transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-muted/50 rounded-md">
                          {getActionIcon(activity.action)}
                        </div>
                        <span className="font-medium text-foreground text-sm">
                          {formatText(activity.action)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {new Date(activity.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2 py-0.5 rounded border ${getRoleBadgeColor(activity.authorRole)}`}>
                        {activity.authorRole}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        by {activity.author}
                      </span>
                    </div>

                    {/* Field Changes */}
                    {(activity.oldValue || activity.newValue) && (
                      <div className="mb-3 bg-card/30 rounded p-2 text-xs border border-border/30">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                            {activity.fieldChanged || 'Change'}:
                          </span>
                          {activity.oldValue && (
                            <span className="line-through text-red-400/70">
                              {formatText(activity.oldValue)}
                            </span>
                          )}
                          {activity.oldValue && activity.newValue && (
                            <span className="text-muted-foreground">→</span>
                          )}
                          {activity.newValue && (
                            <span className="text-green-400 font-medium">
                              {formatText(activity.newValue)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {activity.notes && (
                      <div className="relative mt-2">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/30 rounded-full"></div>
                        <div className="pl-3 py-1">
                          <p className="text-xs text-muted-foreground italic leading-relaxed">
                            "{activity.notes}"
                          </p>
                        </div>
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
