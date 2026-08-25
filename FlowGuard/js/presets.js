/**
 * FlowGuard AI - Preset Rules and Benchmark Scenarios
 * Convert English Rules into Verified Workflows
 */

export const PRESET_RULES = [
  {
    id: 'valid-po-approval',
    name: 'Valid: PO Approval Flow',
    category: 'valid',
    badge: 'Safe to Execute',
    icon: '✅',
    ruleText: 'If order > ₹50,000, get manager approval and create purchase order; otherwise create purchase order directly.',
    description: 'Compliant threshold-based routing with explicit true/false paths and appropriate role authorization.',
    defaultRole: 'Employee',
    expectedVerdict: 'VALID',
    policyConfig: {
      maxBudget: 500000,
      dualApprovalThreshold: 100000,
      disallowSelfApproval: true,
      mandatoryVendorCheck: false
    }
  },
  {
    id: 'error-circular-loop',
    name: 'Loop Bug: Infinite Cycle',
    category: 'loop',
    badge: 'Circular Dependency',
    icon: '🔄',
    ruleText: 'If order is rejected by manager, request manager review, which re-submits order for manager approval.',
    description: 'Contains a circular loop (A → B → C → A) where rejection creates an infinite evaluation trap.',
    defaultRole: 'Employee',
    expectedVerdict: 'NEEDS_CORRECTION',
    policyConfig: {
      maxBudget: 500000,
      dualApprovalThreshold: 100000,
      disallowSelfApproval: true
    }
  },
  {
    id: 'error-unreachable-step',
    name: 'Dead End: Unreachable Step',
    category: 'unreachable',
    badge: 'Unreachable Step',
    icon: '⚠️',
    ruleText: 'If order > ₹50,000, get manager approval and create purchase order. Trigger immediate VIP concierge gift dispatch.',
    description: 'The VIP gift dispatch action is disconnected or blocked with no reachable path from input trigger.',
    defaultRole: 'Employee',
    expectedVerdict: 'NEEDS_CORRECTION',
    policyConfig: {
      maxBudget: 500000,
      dualApprovalThreshold: 100000,
      disallowSelfApproval: true
    }
  },
  {
    id: 'error-permission-violation',
    name: 'Security: Privilege Escalation',
    category: 'permission',
    badge: 'Auth Violation',
    icon: '🔒',
    ruleText: 'If order > ₹250,000, Intern directly approves high-value corporate treasury disbursement.',
    description: 'Role authorization failure: Intern role lacks clearance for high-value treasury disbursement.',
    defaultRole: 'Intern',
    expectedVerdict: 'NEEDS_CORRECTION',
    policyConfig: {
      maxBudget: 500000,
      dualApprovalThreshold: 100000,
      disallowSelfApproval: true
    }
  },
  {
    id: 'warn-ambiguous-rule',
    name: 'Ambiguity: Vague Criteria',
    category: 'ambiguity',
    badge: 'Ambiguous Rule',
    icon: '❓',
    ruleText: 'If high value order arrives, someone approves and process quickly without delay.',
    description: 'Vague condition ("high value"), unspecified actor ("someone"), and missing fallback handling.',
    defaultRole: 'Employee',
    expectedVerdict: 'NEEDS_CORRECTION',
    policyConfig: {
      maxBudget: 500000,
      dualApprovalThreshold: 100000,
      disallowSelfApproval: true
    }
  },
  {
    id: 'error-business-rule-breach',
    name: 'Compliance: Policy Violation',
    category: 'business',
    badge: 'Policy Breach',
    icon: '📋',
    ruleText: 'If order = ₹650,000, get Team Lead approval and immediately execute vendor payment.',
    description: 'Violates enterprise policy: exceeds ₹500,000 budget cap and lacks mandatory VP dual-signoff.',
    defaultRole: 'Employee',
    expectedVerdict: 'NEEDS_CORRECTION',
    policyConfig: {
      maxBudget: 500000,
      dualApprovalThreshold: 100000,
      disallowSelfApproval: true
    }
  }
];

export const RBAC_ROLES = [
  { id: 'Intern', label: 'Intern', maxLimit: 5000, canApprove: false, clearance: 1 },
  { id: 'Employee', label: 'Employee', maxLimit: 25000, canApprove: false, clearance: 2 },
  { id: 'TeamLead', label: 'Team Lead', maxLimit: 75000, canApprove: true, clearance: 3 },
  { id: 'Manager', label: 'Department Manager', maxLimit: 200000, canApprove: true, clearance: 4 },
  { id: 'FinanceLead', label: 'Finance Lead', maxLimit: 500000, canApprove: true, clearance: 5 },
  { id: 'VP_Executive', label: 'VP / Executive', maxLimit: 2000000, canApprove: true, clearance: 6 },
  { id: 'Admin', label: 'System Admin', maxLimit: Infinity, canApprove: true, clearance: 7 }
];

export const ENTERPRISE_POLICIES = {
  maxAllowedSingleOrder: 500000,
  dualApprovalThreshold: 100000,
  prohibitSelfApproval: true,
  requireAuditLogStep: true,
  currency: '₹'
};
