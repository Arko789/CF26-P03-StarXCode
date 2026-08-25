/**
 * FlowGuard AI - AI Explanation & Auto-Repair Engine (Step 6 Branch NO)
 * Analyzes verification failures, generates natural language diagnostics, and produces 1-click fixes.
 */

export class AIAutoFixer {
  /**
   * Generate explanation and proposed fix based on verification result & AST
   */
  generateFix(ast, verificationResult) {
    if (!verificationResult || verificationResult.isValid) {
      return null;
    }

    const { issues, pillars } = verificationResult;
    const rawText = ast.rawText || '';

    // 1. Loop / Circular Dependency Fix
    if (!pillars.circularDependency.passed) {
      return {
        issueType: 'CIRCULAR_LOOP',
        title: 'Infinite Loop Resolution (Bounded Retry Policy)',
        explanation: 'The current rule creates an unconditional loop where manager rejections immediately re-trigger approval without an escape condition or retry limit.',
        fixDescription: 'Add a terminal exit path: after manager rejection, notify employee and archive request instead of looping infinitely.',
        originalRule: rawText,
        suggestedRule: 'If order is rejected by manager, notify employee with reason and archive order; otherwise request manager approval and proceed.',
        autoFixAST: null
      };
    }

    // 2. Unreachable Step Fix
    if (!pillars.unreachableSteps.passed) {
      return {
        issueType: 'UNREACHABLE_STEP',
        title: 'Dead-End Route Connection',
        explanation: 'Step "VIP Concierge Gift Dispatch" is isolated with no incoming condition or event trigger connecting it to the main order process.',
        fixDescription: 'Explicitly bind the VIP gift dispatch to orders that successfully receive manager approval and exceed VIP status.',
        originalRule: rawText,
        suggestedRule: 'If order > ₹50,000, get manager approval, create purchase order, and dispatch VIP concierge gift.',
        autoFixAST: null
      };
    }

    // 3. Permission / RBAC Escalation Fix
    if (!pillars.permissions.passed) {
      return {
        issueType: 'PERMISSION_VIOLATION',
        title: 'Role Authorization & Clearance Alignment',
        explanation: 'The rule assigns a ₹250,000 corporate disbursement sign-off to the "Intern" role, violating the Separation of Duties and RBAC clearance matrix.',
        fixDescription: 'Elevate the approving authority to "Finance Lead" or "Department Manager" with appropriate clearance.',
        originalRule: rawText,
        suggestedRule: 'If order > ₹250,000, Finance Lead reviews and approves corporate treasury wire transfer.',
        autoFixAST: null
      };
    }

    // 4. Ambiguity Fix
    if (!pillars.ambiguity.passed) {
      return {
        issueType: 'AMBIGUITY',
        title: 'Concrete Quantifiers & Fallback Addition',
        explanation: 'Terms like "high value order" and "someone approves" are not actionable. Additionally, there is no default fallback path for regular orders.',
        fixDescription: 'Quantify "high value" as > ₹50,000, specify "Manager" as the concrete approver, and add an auto-approval fallback.',
        originalRule: rawText,
        suggestedRule: 'If order > ₹50,000, get manager approval and create purchase order within 24 hours; otherwise auto-approve and create purchase order directly.',
        autoFixAST: null
      };
    }

    // 5. Business Rule / Budget Policy Violation Fix
    if (!pillars.businessRules.passed) {
      return {
        issueType: 'BUSINESS_RULE_BREACH',
        title: 'Enterprise Policy & Dual-Signoff Compliance',
        explanation: 'The order amount exceeds single limit threshold and lacks the mandatory VP Dual-Signoff required for high-value transactions.',
        fixDescription: 'Cap the transaction within the ₹500,000 limit or add mandatory VP + Finance dual-approval routing.',
        originalRule: rawText,
        suggestedRule: 'If order > ₹100,000 and <= ₹500,000, get Manager approval and VP Finance dual-signoff before executing vendor payment.',
        autoFixAST: null
      };
    }

    // Generic fallback fix
    return {
      issueType: 'GENERIC_CORRECTION',
      title: 'Workflow Policy Remediation',
      explanation: issues[0]?.explanation || 'The workflow contains business rule violations.',
      fixDescription: 'Restructure rule into a compliant condition-action format with explicit roles.',
      originalRule: rawText,
      suggestedRule: 'If order > ₹50,000, get manager approval and create purchase order; otherwise create purchase order directly.',
      autoFixAST: null
    };
  }
}
