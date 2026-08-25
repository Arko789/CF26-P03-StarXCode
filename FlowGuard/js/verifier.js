/**
 * FlowGuard AI - 5-Pillar Verification Engine (Step 5)
 * Checks the workflow for safety, correctness, permissions, and business policy compliance.
 */

import { RBAC_ROLES, ENTERPRISE_POLICIES } from './presets.js';

export class WorkflowVerifier {
  constructor() {
    this.rbac = RBAC_ROLES;
    this.policies = { ...ENTERPRISE_POLICIES };
  }

  updatePolicy(newPolicies) {
    this.policies = { ...this.policies, ...newPolicies };
  }

  /**
   * Run complete 5-Pillar Verification suite on the Workflow AST
   */
  verify(ast) {
    if (!ast || !ast.nodes || !ast.edges) {
      return {
        isValid: false,
        score: 0,
        verdict: 'INVALID_AST',
        pillars: {},
        issues: [{ type: 'ERROR', message: 'Invalid or empty workflow AST provided.' }]
      };
    }

    const p1 = this.checkCircularDependencies(ast);
    const p2 = this.checkUnreachableSteps(ast);
    const p3 = this.checkAmbiguity(ast);
    const p4 = this.checkPermissions(ast);
    const p5 = this.checkBusinessRules(ast);

    const allIssues = [
      ...p1.issues,
      ...p2.issues,
      ...p3.issues,
      ...p4.issues,
      ...p5.issues
    ];

    const errorCount = allIssues.filter(i => i.severity === 'ERROR').length;
    const warningCount = allIssues.filter(i => i.severity === 'WARNING').length;

    // Is Workflow Valid? (Step 6 Branch Decision)
    const isValid = errorCount === 0;
    
    // Safety score calculation (0 - 100)
    let score = 100;
    score -= errorCount * 30;
    score -= warningCount * 10;
    score = Math.max(0, Math.min(100, score));

    return {
      isValid,
      verdict: isValid ? 'SAFE_TO_EXECUTE' : 'NEEDS_CORRECTION',
      score,
      counts: { errors: errorCount, warnings: warningCount },
      pillars: {
        circularDependency: p1,
        unreachableSteps: p2,
        ambiguity: p3,
        permissions: p4,
        businessRules: p5
      },
      issues: allIssues,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * 5.1 CIRCULAR DEPENDENCY CHECK
   * Checks if workflow has any loop (A -> B -> C -> A)
   * Result: Error if loop exists
   */
  checkCircularDependencies(ast) {
    const adj = new Map();
    ast.nodes.forEach(n => adj.set(n.id, []));
    ast.edges.forEach(e => {
      if (adj.has(e.from)) {
        adj.get(e.from).push(e.to);
      }
    });

    const visited = new Set();
    const recStack = new Set();
    let detectedCycle = null;

    const dfs = (nodeId, path = []) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const nextId of neighbors) {
        if (!visited.has(nextId)) {
          if (dfs(nextId, [...path])) return true;
        } else if (recStack.has(nextId)) {
          // Cycle found!
          const cycleStartIndex = path.indexOf(nextId);
          detectedCycle = cycleStartIndex !== -1 ? path.slice(cycleStartIndex).concat(nextId) : [nodeId, nextId];
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of ast.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) break;
      }
    }

    const passed = !detectedCycle;
    const issues = [];

    if (!passed) {
      const cycleStr = detectedCycle.map(id => {
        const n = ast.nodes.find(node => node.id === id);
        return n ? n.label : id;
      }).join(' → ');

      issues.push({
        pillar: '5.1 Circular Dependency',
        severity: 'ERROR',
        code: 'ERR_LOOP_DETECTED',
        nodeIds: detectedCycle,
        message: `Infinite loop detected in workflow execution path: ${cycleStr}`,
        explanation: 'The workflow routes back to an ancestor node without an exit terminal or bounded retry counter, causing an infinite evaluation loop.'
      });
    }

    return {
      pillarId: '5.1',
      name: 'Circular Dependency Check',
      passed,
      status: passed ? 'PASS' : 'FAIL',
      resultText: passed ? '0 Loops Detected (Acyclic graph verified)' : 'Loop Detected: Infinite evaluation cycle',
      cycleNodes: detectedCycle,
      issues
    };
  }

  /**
   * 5.2 UNREACHABLE STEP CHECK
   * Checks steps that can never be reached (dead ends / disconnected nodes)
   * Result: Warn/Error if any step unreachable
   */
  checkUnreachableSteps(ast) {
    const triggerNodes = ast.nodes.filter(n => n.type === 'TRIGGER' || n.id === 'node_start');
    const startIds = triggerNodes.length > 0 ? triggerNodes.map(n => n.id) : [ast.nodes[0]?.id].filter(Boolean);
    
    const reachable = new Set();
    const queue = [...startIds];
    startIds.forEach(id => reachable.add(id));

    const adj = new Map();
    ast.nodes.forEach(n => adj.set(n.id, []));
    ast.edges.forEach(e => {
      if (adj.has(e.from)) adj.get(e.from).push(e.to);
    });

    while (queue.length > 0) {
      const curr = queue.shift();
      const nextNodes = adj.get(curr) || [];
      for (const nextId of nextNodes) {
        if (!reachable.has(nextId)) {
          reachable.add(nextId);
          queue.push(nextId);
        }
      }
    }

    const unreachableNodes = ast.nodes.filter(n => !reachable.has(n.id) || n.metadata?.unreachable);
    const passed = unreachableNodes.length === 0;
    const issues = [];

    if (!passed) {
      unreachableNodes.forEach(node => {
        issues.push({
          pillar: '5.2 Unreachable Step',
          severity: 'WARNING',
          code: 'WARN_UNREACHABLE_STEP',
          nodeIds: [node.id],
          message: `Unreachable step: "${node.label}" can never be triggered.`,
          explanation: `There is no valid execution pathway connecting the initial trigger to step [${node.id}]. This represents a dead code trap or missing condition edge.`
        });
      });
    }

    return {
      pillarId: '5.2',
      name: 'Unreachable Step Check',
      passed,
      status: passed ? 'PASS' : 'WARN',
      resultText: passed ? 'All steps are reachable from trigger' : `${unreachableNodes.length} unreachable step(s) detected`,
      unreachableNodes: unreachableNodes.map(n => n.id),
      issues
    };
  }

  /**
   * 5.3 AMBIGUITY CHECK
   * Checks for unclear or incomplete instructions (missing else, vague roles, vague thresholds)
   * Result: Ask for clarification / flag warnings
   */
  checkAmbiguity(ast) {
    const issues = [];

    // 1. Check Condition nodes with missing false/else branch
    const conditionNodes = ast.nodes.filter(n => n.type === 'CONDITION');
    conditionNodes.forEach(cond => {
      const outEdges = ast.edges.filter(e => e.from === cond.id);
      const hasFalseBranch = outEdges.some(e => e.branch === 'false' || (e.label && e.label.toLowerCase().includes('no')) || (e.label && e.label.toLowerCase().includes('otherwise')));
      
      if (outEdges.length < 2 && !hasFalseBranch) {
        issues.push({
          pillar: '5.3 Ambiguity Check',
          severity: 'WARNING',
          code: 'WARN_MISSING_FALLBACK',
          nodeIds: [cond.id],
          message: `Incomplete condition branching: "${cond.label}" is missing a fallback (else / false) pathway.`,
          explanation: 'When the threshold condition evaluates to FALSE, the workflow state will be trapped with no specified alternative action.'
        });
      }
    });

    // 2. Check for vague/unassigned actors or terms
    ast.nodes.forEach(node => {
      const labelLower = (node.label || '').toLowerCase();
      const roleLower = (node.role || '').toLowerCase();

      if (roleLower.includes('someone') || roleLower.includes('unknown') || roleLower.includes('user')) {
        issues.push({
          pillar: '5.3 Ambiguity Check',
          severity: 'WARNING',
          code: 'WARN_VAGUE_ACTOR',
          nodeIds: [node.id],
          message: `Unclear role assignment: Step "${node.label}" is assigned to vague entity "${node.role}".`,
          explanation: 'Business processes require a concrete RBAC role (e.g. Manager, Finance Lead, Admin) rather than generic placeholders.'
        });
      }

      if (labelLower.includes('high value') || labelLower.includes('quickly') || labelLower.includes('promptly') || node.metadata?.ambiguous) {
        issues.push({
          pillar: '5.3 Ambiguity Check',
          severity: 'WARNING',
          code: 'WARN_VAGUE_CRITERIA',
          nodeIds: [node.id],
          message: `Vague criteria in step "${node.label}".`,
          explanation: 'Phrases like "high value" or "process promptly" lack strict numeric thresholds or measurable SLA timeouts.'
        });
      }
    });

    const passed = issues.length === 0;
    return {
      pillarId: '5.3',
      name: 'Ambiguity Check',
      passed,
      status: passed ? 'PASS' : 'WARN',
      resultText: passed ? '0 Ambiguities (Rules are clear & comprehensive)' : `${issues.length} ambiguity / missing branch warning(s)`,
      issues
    };
  }

  /**
   * 5.4 PERMISSION CHECK
   * Checks if the user / role has permission for each step
   * Result: Authorization error if not allowed
   */
  checkPermissions(ast) {
    const issues = [];
    const initiatorRole = ast.initiatorRole || 'Employee';
    const initiatorMeta = this.rbac.find(r => r.id === initiatorRole) || { clearance: 2, canApprove: false, maxLimit: 25000 };

    ast.nodes.forEach(node => {
      if (node.type === 'APPROVAL') {
        const assignedRole = node.role || 'Manager';
        const roleMeta = this.rbac.find(r => r.id === assignedRole) || { clearance: 1, canApprove: false, maxLimit: 0 };

        // Check if assigned role has approval authority
        if (!roleMeta.canApprove || node.metadata?.unauthorized) {
          issues.push({
            pillar: '5.4 Permission Check',
            severity: 'ERROR',
            code: 'ERR_UNAUTHORIZED_ROLE',
            nodeIds: [node.id],
            message: `Authorization violation: Role "${assignedRole}" lacks approval authority for step "${node.label}".`,
            explanation: `The role [${assignedRole}] has clearance level ${roleMeta.clearance}, but approval authority requires at least clearance level 3 (Team Lead or above).`
          });
        }

        // Check self-approval constraint
        if (this.policies.prohibitSelfApproval && assignedRole === initiatorRole && roleMeta.clearance < 5) {
          issues.push({
            pillar: '5.4 Permission Check',
            severity: 'ERROR',
            code: 'ERR_SELF_APPROVAL_DISALLOWED',
            nodeIds: [node.id],
            message: `Separation of Duties violation: Initiator "${initiatorRole}" cannot approve their own submission.`,
            explanation: 'Enterprise governance policy prohibits self-approval. An independent manager or higher authority must approve.'
          });
        }
      }
    });

    const passed = issues.length === 0;
    return {
      pillarId: '5.4',
      name: 'Permission Check',
      passed,
      status: passed ? 'PASS' : 'FAIL',
      resultText: passed ? 'All steps authorized (RBAC & Separation of Duties satisfied)' : `${issues.length} authorization / permission error(s)`,
      issues
    };
  }

  /**
   * 5.5 BUSINESS RULE CHECK
   * Checks business rules (budget limits, mandatory dual approvals, compliance)
   * Result: Rule violation if any
   */
  checkBusinessRules(ast) {
    const issues = [];
    const rawLower = (ast.rawText || '').toLowerCase();

    // 1. Check maximum single order cap
    const amountMatch = ast.rawText?.match(/[₹$€]?\s*(\d[\d,]*)/);
    let amount = 0;
    if (amountMatch && amountMatch[1]) {
      amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);
    }

    if (amount > this.policies.maxAllowedSingleOrder) {
      issues.push({
        pillar: '5.5 Business Rule Check',
        severity: 'ERROR',
        code: 'ERR_BUDGET_CAP_EXCEEDED',
        nodeIds: [ast.nodes[0]?.id],
        message: `Budget Limit Exceeded: Order amount ₹${amount.toLocaleString()} exceeds enterprise maximum single limit of ₹${this.policies.maxAllowedSingleOrder.toLocaleString()}.`,
        explanation: 'Transactions exceeding the absolute single-order budget limit cannot proceed through standard workflow routing without Board / VP exception authorization.'
      });
    }

    // 2. Check dual approval requirement for high-value orders
    if (amount >= this.policies.dualApprovalThreshold) {
      const approvalCount = ast.nodes.filter(n => n.type === 'APPROVAL').length;
      const hasVPOrFinance = ast.nodes.some(n => n.role === 'VP_Executive' || n.role === 'FinanceLead');

      if (approvalCount < 2 && !hasVPOrFinance && !rawLower.includes('dual') && !rawLower.includes('two')) {
        issues.push({
          pillar: '5.5 Business Rule Check',
          severity: 'ERROR',
          code: 'ERR_MANDATORY_DUAL_APPROVAL',
          nodeIds: ast.nodes.filter(n => n.type === 'APPROVAL').map(n => n.id),
          message: `Mandatory Dual-Approval Missing: Orders ≥ ₹${this.policies.dualApprovalThreshold.toLocaleString()} require secondary Finance/VP signoff.`,
          explanation: `Corporate policy requires tiered dual sign-off (Manager + Finance VP) for any financial commitment exceeding ₹${this.policies.dualApprovalThreshold.toLocaleString()}.`
        });
      }
    }

    const passed = issues.length === 0;
    return {
      pillarId: '5.5',
      name: 'Business Rule Check',
      passed,
      status: passed ? 'PASS' : 'FAIL',
      resultText: passed ? 'All business rules & compliance policies passed' : `${issues.length} business policy violation(s)`,
      issues
    };
  }
}
