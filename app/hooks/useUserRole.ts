/**
 * useUserRole Hook
 * Detects current user's maintenance role for a project
 */

import { useState, useEffect } from 'react';

export type MaintenanceRole = 'TM' | 'FM' | 'Maintainer' | 'User' | null;

export function useUserRole(projectId: string | undefined): {
  role: MaintenanceRole;
  loading: boolean;
  isTM: boolean;
  isFM: boolean;
  isMaintainer: boolean;
} {
  const [role, setRole] = useState<MaintenanceRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    async function fetchRole() {
      try {
        const res = await fetch(`/api/projects/${projectId}/user-role`);
        if (res.ok) {
          const data = await res.json();
          setRole(data.role || 'User');
        } else {
          setRole('User');
        }
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        setRole('User');
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [projectId]);

  return {
    role,
    loading,
    isTM: role === 'TM',
    isFM: role === 'FM',
    isMaintainer: role === 'Maintainer',
  };
}
