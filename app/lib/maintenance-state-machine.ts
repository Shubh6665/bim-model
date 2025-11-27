/**
 * Maintenance System State Machine
 * 
 * Enforces strict state transitions based on roles and current state
 * 
 * TICKET FLOW:
 * PENDING_APPROVAL → APPROVED (TM only) → Work Order Created
 * PENDING_APPROVAL → REJECTED (TM only) → ARCHIVED
 * 
 * WORK ORDER FLOW:
 * OPEN → PLANNED → IN_PROGRESS → CLOSE (TM or Maintainer)
 * CLOSE → RESOLVED (TM only)
 * RESOLVED → OPEN (FM Integration Request) → Repeat cycle
 */

import { MaintenanceRole } from './maintenance-roles';

// Ticket States
export type TicketState = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

// Work Order States
export type WorkOrderState = 'OPEN' | 'PLANNED' | 'IN_PROGRESS' | 'CLOSE' | 'RESOLVED';

/**
 * Ticket State Transition Validation
 */
export interface TicketTransition {
  from: TicketState;
  to: TicketState;
  allowedRoles: MaintenanceRole[];
  requiresFields?: string[];
}

const TICKET_TRANSITIONS: TicketTransition[] = [
  {
    from: 'PENDING_APPROVAL',
    to: 'APPROVED',
    allowedRoles: ['TM'],
    requiresFields: ['priority', 'type'], // TM must set these on approval
  },
  {
    from: 'PENDING_APPROVAL',
    to: 'REJECTED',
    allowedRoles: ['TM'],
    requiresFields: ['rejectionReason'],
  },
  {
    from: 'REJECTED',
    to: 'ARCHIVED',
    allowedRoles: ['TM'],
  },
  {
    from: 'APPROVED',
    to: 'ARCHIVED',
    allowedRoles: ['TM'], // TM can archive approved tickets
  },
];

/**
 * Work Order State Transition Validation
 */
export interface WorkOrderTransition {
  from: WorkOrderState;
  to: WorkOrderState;
  allowedRoles: MaintenanceRole[];
  requiresFields?: string[];
}

const WORK_ORDER_TRANSITIONS: WorkOrderTransition[] = [
  // Initial transition from OPEN to PLANNED
  {
    from: 'OPEN',
    to: 'PLANNED',
    allowedRoles: ['TM', 'Maintainer'],
  },
  // PLANNED to IN_PROGRESS
  {
    from: 'PLANNED',
    to: 'IN_PROGRESS',
    allowedRoles: ['TM', 'Maintainer'],
  },
  // IN_PROGRESS to CLOSE
  {
    from: 'IN_PROGRESS',
    to: 'CLOSE',
    allowedRoles: ['TM', 'Maintainer'],
  },
  // CLOSE to RESOLVED (TM only)
  {
    from: 'CLOSE',
    to: 'RESOLVED',
    allowedRoles: ['TM'],
    requiresFields: ['tmClosingNotes'],
  },
  // FM Integration: RESOLVED back to OPEN (creates new cycle)
  {
    from: 'RESOLVED',
    to: 'OPEN',
    allowedRoles: ['FM'],
    requiresFields: ['integrationReason'],
  },
  // Allow direct OPEN to CLOSE (for urgent fixes without formal planning)
  {
    from: 'OPEN',
    to: 'CLOSE',
    allowedRoles: ['TM'],
  },
];

/**
 * Validate if a ticket state transition is allowed
 */
export function isValidTicketTransition(
  currentState: TicketState,
  newState: TicketState,
  userRole: MaintenanceRole
): { valid: boolean; reason?: string; requiredFields?: string[] } {
  // Same state is always valid (no-op)
  if (currentState === newState) {
    return { valid: true };
  }

  // Find matching transition rule
  const transition = TICKET_TRANSITIONS.find(
    (t) => t.from === currentState && t.to === newState
  );

  if (!transition) {
    return {
      valid: false,
      reason: `No transition rule exists from ${currentState} to ${newState}`,
    };
  }

  // Check if user's role is allowed
  if (!transition.allowedRoles.includes(userRole)) {
    return {
      valid: false,
      reason: `Role ${userRole} is not allowed to transition from ${currentState} to ${newState}. Allowed roles: ${transition.allowedRoles.join(', ')}`,
    };
  }

  return {
    valid: true,
    requiredFields: transition.requiresFields,
  };
}

/**
 * Validate if a work order state transition is allowed
 */
export function isValidWorkOrderTransition(
  currentState: WorkOrderState,
  newState: WorkOrderState,
  userRole: MaintenanceRole
): { valid: boolean; reason?: string; requiredFields?: string[] } {
  // Same state is always valid (no-op)
  if (currentState === newState) {
    return { valid: true };
  }

  // Find matching transition rule
  const transition = WORK_ORDER_TRANSITIONS.find(
    (t) => t.from === currentState && t.to === newState
  );

  if (!transition) {
    return {
      valid: false,
      reason: `No transition rule exists from ${currentState} to ${newState}`,
    };
  }

  // Check if user's role is allowed
  if (!transition.allowedRoles.includes(userRole)) {
    return {
      valid: false,
      reason: `Role ${userRole} is not allowed to transition from ${currentState} to ${newState}. Allowed roles: ${transition.allowedRoles.join(', ')}`,
    };
  }

  return {
    valid: true,
    requiredFields: transition.requiresFields,
  };
}

/**
 * Get all possible next states for a ticket
 */
export function getValidTicketNextStates(
  currentState: TicketState,
  userRole: MaintenanceRole
): TicketState[] {
  return TICKET_TRANSITIONS
    .filter((t) => t.from === currentState && t.allowedRoles.includes(userRole))
    .map((t) => t.to);
}

/**
 * Get all possible next states for a work order
 */
export function getValidWorkOrderNextStates(
  currentState: WorkOrderState,
  userRole: MaintenanceRole
): WorkOrderState[] {
  return WORK_ORDER_TRANSITIONS
    .filter((t) => t.from === currentState && t.allowedRoles.includes(userRole))
    .map((t) => t.to);
}

/**
 * Check if user can edit a specific field based on their role
 */
export function canEditField(
  field: string,
  userRole: MaintenanceRole,
  workOrderStatus?: WorkOrderState
): { allowed: boolean; reason?: string } {
  // TM can edit almost everything
  if (userRole === 'TM') {
    return { allowed: true };
  }

  // FM can only edit Priority and Type
  if (userRole === 'FM') {
    if (field === 'priority' || field === 'type') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'FM can only modify Priority and Type fields',
    };
  }

  // Maintainer can edit operational fields during active maintenance
  if (userRole === 'Maintainer') {
    const allowedFields = [
      'status', // But only PLANNED → IN_PROGRESS → CLOSE
      'notes',
      'attachments',
      'workPerformed',
      'diagnosis',
      'technicalNotes',
    ];

    if (!allowedFields.includes(field)) {
      return {
        allowed: false,
        reason: `Maintainer can only edit: ${allowedFields.join(', ')}`,
      };
    }

    // Maintainer cannot edit if work order is RESOLVED
    if (workOrderStatus === 'RESOLVED') {
      return {
        allowed: false,
        reason: 'Cannot edit fields after work order is RESOLVED',
      };
    }

    return { allowed: true };
  }

  // User cannot edit work orders
  if (userRole === 'User') {
    return {
      allowed: false,
      reason: 'Users cannot edit work orders',
    };
  }

  return {
    allowed: false,
    reason: 'Unknown role or insufficient permissions',
  };
}
