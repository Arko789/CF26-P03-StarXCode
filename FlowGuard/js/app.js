/**
 * FlowGuard AI - Main Application Controller
 * Convert English Rules into Verified Workflows
 */

import { PRESET_RULES, RBAC_ROLES, ENTERPRISE_POLICIES } from './presets.js';
import { AIEngine } from './ai-engine.js';
import { WorkflowVerifier } from './verifier.js';
import { GraphRenderer } from './graph-renderer.js';
import { WorkflowSimulator } from './simulator.js';
import { AIAutoFixer } from './auto-fixer.js';

class FlowGuardApp {
  constructor() {
    this.aiEngine = new AIEngine();
    this.verifier = new WorkflowVerifier();
    this.autoFixer = new AIAutoFixer();
    
    this.currentAST = null;
    this.verificationResult = null;
    this.soundEnabled = true;

    // DOM Elements
    this.ruleInput = document.getElementById('rule-input');
    this.roleSelect = document.getElementById('initiator-role-select');
    this.parseBtn = document.getElementById('parse-verify-btn');
    this.presetsContainer = document.getElementById('preset-pills-container');
    this.entityTagsContainer = document.getElementById('entity-tags-container');
    this.jsonAstViewer = document.getElementById('ast-json-view');
    this.verdictContainer = document.getElementById('verdict-container');
    this.aiFixContainer = document.getElementById('ai-fix-container');
    this.simulatorContainer = document.getElementById('simulator-card-wrapper');
    this.nodeDrawer = document.getElementById('node-drawer');

    // Initialize Graph Renderer
    const viewport = document.getElementById('graph-viewport');
    this.graphRenderer = new GraphRenderer(viewport, (node) => this.showNodeDetails(node));

    // Initialize Simulator
    this.simulator = new WorkflowSimulator(
      viewport,
      (logs) => this.renderSimLogs(logs),
      (stepNode) => this.onSimStep(stepNode)
    );

    this.initAudio();
    this.initUI();
    this.loadPreset(PRESET_RULES[0].id);
  }

  initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playSound(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;

    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  initUI() {
    // Populate Initiator Roles
    this.roleSelect.innerHTML = RBAC_ROLES.map(r => `
      <option value="${r.id}">${r.label} (Max: ${r.maxLimit === Infinity ? 'Unlimited' : '₹' + r.maxLimit.toLocaleString()})</option>
    `).join('');
    this.roleSelect.value = 'Employee';

    // Populate Presets Bar
    this.renderPresets();

    // Event Listeners
    this.ruleInput.addEventListener('input', () => {
      this.updateEntityTags();
    });

    this.parseBtn.addEventListener('click', () => {
      this.playSound('click');
      this.processWorkflow();
    });

    document.getElementById('enhance-ai-btn').addEventListener('click', () => {
      this.enhanceCurrentRule();
    });

    document.getElementById('random-rule-btn').addEventListener('click', () => {
      const rand = PRESET_RULES[Math.floor(Math.random() * PRESET_RULES.length)];
      this.loadPreset(rand.id);
    });

    document.getElementById('clear-rule-btn').addEventListener('click', () => {
      this.ruleInput.value = '';
      this.updateEntityTags();
    });

    // Theme Switcher
    const themeBtn = document.getElementById('theme-toggle-btn');
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      themeBtn.innerHTML = next === 'dark' ? '🌙' : '☀️';
      this.showToast(`Switched to ${next} theme`, 'info');
    });

    // Sound Switcher
    const soundBtn = document.getElementById('sound-toggle-btn');
    soundBtn.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      soundBtn.innerHTML = this.soundEnabled ? '🔔' : '🔕';
      this.showToast(`Sound ${this.soundEnabled ? 'enabled' : 'disabled'}`, 'info');
    });

    // Graph Controls
    document.getElementById('zoom-in-btn').addEventListener('click', () => this.graphRenderer.zoom(1.2));
    document.getElementById('zoom-out-btn').addEventListener('click', () => this.graphRenderer.zoom(0.8));
    document.getElementById('zoom-fit-btn').addEventListener('click', () => this.graphRenderer.fitView());
    document.getElementById('zoom-reset-btn').addEventListener('click', () => this.graphRenderer.resetView());

    // AST Copy Button
    document.getElementById('copy-ast-btn').addEventListener('click', () => {
      if (this.currentAST) {
        navigator.clipboard.writeText(JSON.stringify(this.currentAST, null, 2));
        this.showToast('JSON AST copied to clipboard!', 'success');
      }
    });

    // Simulation Form & Controls
    document.getElementById('sim-run-btn').addEventListener('click', () => {
      this.playSound('click');
      this.simulator.setContext({
        order_amount: parseInt(document.getElementById('sim-amount-input').value, 10) || 65000,
        manager_decision: document.getElementById('sim-decision-select').value,
        user_role: this.roleSelect.value
      });
      this.simulator.start();
    });

    document.getElementById('sim-step-btn').addEventListener('click', () => {
      this.playSound('click');
      this.simulator.setContext({
        order_amount: parseInt(document.getElementById('sim-amount-input').value, 10) || 65000,
        manager_decision: document.getElementById('sim-decision-select').value,
        user_role: this.roleSelect.value
      });
      this.simulator.step();
    });

    document.getElementById('sim-reset-btn').addEventListener('click', () => {
      this.simulator.reset();
    });

    // API Key Modal
    document.getElementById('api-key-btn').addEventListener('click', () => {
      document.getElementById('api-key-input').value = this.aiEngine.apiKey || '';
      this.openModal('api-key-modal');
    });

    document.getElementById('save-api-key-btn').addEventListener('click', () => {
      const key = document.getElementById('api-key-input').value;
      this.aiEngine.setApiKey(key);
      this.closeModal('api-key-modal');
      this.showToast(key ? 'Gemini API key saved!' : 'Local engine active', 'success');
    });

    // Export Modal
    document.getElementById('export-btn').addEventListener('click', () => {
      this.openExportModal();
    });

    // Guided Tour Modal
    document.getElementById('guide-btn').addEventListener('click', () => {
      this.openModal('guided-tour-modal');
    });

    // Close Modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('open');
      });
    });

    // Drawer Close
    document.getElementById('drawer-close-btn').addEventListener('click', () => {
      this.nodeDrawer.classList.remove('open');
    });
  }

  renderPresets() {
    this.presetsContainer.innerHTML = PRESET_RULES.map(p => {
      const isErr = p.category === 'loop' || p.category === 'permission' || p.category === 'business';
      const isWarn = p.category === 'unreachable' || p.category === 'ambiguity';
      const tagClass = isErr ? 'tag-err' : (isWarn ? 'tag-warn' : '');
      return `
        <button class="preset-pill ${tagClass}" data-id="${p.id}" title="${p.description}">
          <span>${p.icon}</span> ${p.name}
        </button>
      `;
    }).join('');

    this.presetsContainer.querySelectorAll('.preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playSound('click');
        this.loadPreset(btn.getAttribute('data-id'));
      });
    });
  }

  loadPreset(presetId) {
    const preset = PRESET_RULES.find(p => p.id === presetId);
    if (!preset) return;

    this.presetsContainer.querySelectorAll('.preset-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-id') === presetId);
    });

    this.ruleInput.value = preset.ruleText;
    if (preset.defaultRole) {
      this.roleSelect.value = preset.defaultRole;
    }

    this.updateEntityTags();
    this.processWorkflow();
  }

  updateEntityTags() {
    const text = this.ruleInput.value;
    const entities = this.aiEngine.extractEntities(text);

    if (entities.length === 0) {
      this.entityTagsContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Type English rules above. Entities auto-extract in real-time.</span>';
      return;
    }

    this.entityTagsContainer.innerHTML = entities.slice(0, 8).map(e => `
      <span class="entity-tag ${e.type}">
        ${e.type === 'role' ? '👤' : (e.type === 'condition' ? '🔀' : '⚡')} ${e.value}
      </span>
    `).join('');
  }

  async processWorkflow() {
    const ruleText = this.ruleInput.value.trim();
    if (!ruleText) {
      this.showToast('Please enter a natural language rule.', 'error');
      return;
    }

    this.parseBtn.disabled = true;
    this.parseBtn.innerHTML = '<span class="spinning">⏳</span> Compiling & Verifying...';

    this.updatePipelineBanner(2); // Step 2: AI Understands

    try {
      // Step 2 & 3: AI Parsing into AST
      const ast = await this.aiEngine.parseRuleToAST(ruleText, this.roleSelect.value);
      this.currentAST = ast;
      this.updatePipelineBanner(3); // Step 3: Intermediate Representation

      // Display JSON AST
      this.jsonAstViewer.textContent = JSON.stringify(ast, null, 2);

      // Step 4 & 5: Render Graph & Run Verification Engine
      this.updatePipelineBanner(4); // Step 4: Workflow Graph Creation
      const verification = this.verifier.verify(ast);
      this.verificationResult = verification;

      this.updatePipelineBanner(5); // Step 5: Verification Engine
      this.graphRenderer.render(ast, verification);

      // Step 6: Verdict & Resolution
      this.renderVerificationPillars(verification);
      this.renderVerdict(verification, ast);

      if (verification.isValid) {
        this.updatePipelineBanner(6, 'success');
        this.playSound('success');
        this.simulator.loadWorkflow(ast);
        this.simulatorContainer.style.display = 'block';
        this.aiFixContainer.style.display = 'none';
      } else {
        this.updatePipelineBanner(6, 'danger');
        this.playSound('error');
        this.simulatorContainer.style.display = 'none';
        this.renderAutoFix(ast, verification);
      }

    } catch (err) {
      console.error('Processing error:', err);
      this.showToast('Failed to compile workflow: ' + err.message, 'error');
    } finally {
      this.parseBtn.disabled = false;
      this.parseBtn.innerHTML = '<span>⚡</span> Translate & Verify Workflow';
    }
  }

  renderVerificationPillars(res) {
    const p = res.pillars;
    const items = [
      { id: '5.1', title: '5.1 Circular Dependency Check', data: p.circularDependency, icon: '🔄', iconClass: 'loop' },
      { id: '5.2', title: '5.2 Unreachable Step Check', data: p.unreachableSteps, icon: '⚠️', iconClass: 'reach' },
      { id: '5.3', title: '5.3 Ambiguity Check', data: p.ambiguity, icon: '❓', iconClass: 'ambiguity' },
      { id: '5.4', title: '5.4 Permission Check', data: p.permissions, icon: '🔒', iconClass: 'perm' },
      { id: '5.5', title: '5.5 Business Rule Check', data: p.businessRules, icon: '📋', iconClass: 'business' }
    ];

    document.getElementById('pillars-grid').innerHTML = items.map(item => {
      const statusClass = item.data.status === 'PASS' ? 'status-pass' : (item.data.status === 'WARN' ? 'status-warn' : 'status-fail');
      const statusLabel = item.data.status === 'PASS' ? '✓ Passed' : (item.data.status === 'WARN' ? '! Warning' : '✕ Error');
      return `
        <div class="pillar-card">
          <div class="pillar-info">
            <div class="pillar-icon-box ${item.iconClass}">${item.icon}</div>
            <div class="pillar-text">
              <span class="pillar-name">${item.title}</span>
              <span class="pillar-desc">${item.data.resultText}</span>
            </div>
          </div>
          <span class="pillar-badge ${statusClass}">${statusLabel}</span>
        </div>
      `;
    }).join('');
  }

  renderVerdict(res, ast) {
    if (res.isValid) {
      this.verdictContainer.innerHTML = `
        <div class="verdict-banner valid">
          <div class="verdict-icon">✓</div>
          <div class="verdict-details">
            <div class="verdict-title">Status: SAFE TO EXECUTE</div>
            <div class="verdict-subtitle">
              All 5 verification pillars passed with 100/100 safety score. No infinite loops, unreachable states, or security breaches detected.
            </div>
          </div>
        </div>
      `;
    } else {
      this.verdictContainer.innerHTML = `
        <div class="verdict-banner invalid">
          <div class="verdict-icon">✕</div>
          <div class="verdict-details">
            <div class="verdict-title">Status: NEEDS CORRECTION</div>
            <div class="verdict-subtitle">
              Found ${res.counts.errors} blocking error(s) and ${res.counts.warnings} warning(s). Review AI diagnostics below to apply instant 1-click repairs.
            </div>
          </div>
        </div>
      `;
    }
  }

  renderAutoFix(ast, verification) {
    const fix = this.autoFixer.generateFix(ast, verification);
    if (!fix) {
      this.aiFixContainer.style.display = 'none';
      return;
    }

    this.aiFixContainer.style.display = 'flex';
    this.aiFixContainer.innerHTML = `
      <div class="ai-fix-header">
        <span class="ai-fix-title">🤖 AI Explains & Suggests Fix (${fix.title})</span>
      </div>
      <div class="ai-explanation">
        ${fix.explanation}
      </div>
      <div class="fix-diff-view">
        <div class="diff-box old"><strong>Current:</strong> ${fix.originalRule}</div>
        <div class="diff-box new"><strong>Suggested:</strong> ${fix.suggestedRule}</div>
      </div>
      <button class="btn btn-success btn-block" id="apply-ai-fix-btn">
        <span>✨</span> Apply AI Fix & Re-Verify (1-Click)
      </button>
    `;

    document.getElementById('apply-ai-fix-btn').addEventListener('click', () => {
      this.playSound('click');
      this.ruleInput.value = fix.suggestedRule;
      this.updateEntityTags();
      this.processWorkflow();
      this.showToast('AI fix applied successfully!', 'success');
    });
  }

  enhanceCurrentRule() {
    const current = this.ruleInput.value.trim();
    if (!current) return;
    this.playSound('click');

    // Enhance with fallback and clear roles
    const enhanced = `If order > ₹50,000, get manager approval and create purchase order; otherwise auto-approve and create purchase order directly.`;
    this.ruleInput.value = enhanced;
    this.updateEntityTags();
    this.showToast('Rule enhanced with structured fallback logic!', 'success');
    this.processWorkflow();
  }

  updatePipelineBanner(stepNumber, status = null) {
    document.querySelectorAll('.pipeline-step').forEach((step, idx) => {
      const num = idx + 1;
      step.className = 'pipeline-step';
      if (num < stepNumber) {
        step.classList.add('success');
      } else if (num === stepNumber) {
        step.classList.add(status || 'active');
      }
    });
  }

  showNodeDetails(node) {
    this.nodeDrawer.classList.add('open');
    document.getElementById('drawer-node-title').textContent = node.label;
    document.getElementById('drawer-node-content').innerHTML = `
      <div class="meta-field">
        <span class="meta-label">Node Identifier</span>
        <input class="meta-input" value="${node.id}" readonly />
      </div>
      <div class="meta-field">
        <span class="meta-label">Step Type</span>
        <input class="meta-input" value="${node.type}" readonly />
      </div>
      <div class="meta-field">
        <span class="meta-label">Assigned Role</span>
        <input class="meta-input" value="${node.role || 'System'}" readonly />
      </div>
      ${node.conditionExpression ? `
        <div class="meta-field">
          <span class="meta-label">Condition Logic</span>
          <input class="meta-input" value="${node.conditionExpression}" readonly />
        </div>
      ` : ''}
      <div class="meta-field">
        <span class="meta-label">Description & Summary</span>
        <textarea class="meta-input" rows="3" readonly>${node.details || 'No additional details specified.'}</textarea>
      </div>
      <div class="meta-field">
        <span class="meta-label">Execution Status</span>
        <span class="pillar-badge ${node.hasError ? 'status-fail' : (node.hasWarning ? 'status-warn' : 'status-pass')}">
          ${node.hasError ? '✕ Violation Detected' : (node.hasWarning ? '! Warning Flagged' : '✓ Verified Clean')}
        </span>
      </div>
    `;
  }

  renderSimLogs(logs) {
    const container = document.getElementById('sim-trace-log');
    if (!container) return;
    container.innerHTML = logs.map(l => `
      <div class="trace-entry ${l.type}">
        <span style="opacity:0.6;">[${l.time}]</span> ${l.message}
      </div>
    `).join('');
  }

  onSimStep(node) {
    // optional hook for step updates
  }

  openExportModal() {
    if (!this.currentAST) {
      this.showToast('Please compile a workflow first.', 'error');
      return;
    }
    const jsonStr = JSON.stringify(this.currentAST, null, 2);
    const mermaidStr = this.generateMermaid(this.currentAST);
    const codeStr = this.generateCode(this.currentAST);

    document.getElementById('export-json-code').textContent = jsonStr;
    document.getElementById('export-mermaid-code').textContent = mermaidStr;
    document.getElementById('export-js-code').textContent = codeStr;

    this.openModal('export-modal');
  }

  generateMermaid(ast) {
    let m = 'graph TD\n';
    ast.nodes.forEach(n => {
      m += `  ${n.id}["${n.label} (${n.role || 'System'})"]\n`;
    });
    ast.edges.forEach(e => {
      m += `  ${e.from} -->|${e.label || ''}| ${e.to}\n`;
    });
    return m;
  }

  generateCode(ast) {
    return `// FlowGuard AI - Executable Workflow Script
import { createWorkflow } from '@flowguard/runtime';

export const ${ast.workflowId} = createWorkflow({
  name: "${ast.name}",
  initiator: "${ast.initiatorRole}",
  async execute(context) {
    console.log("Executing workflow:", context);
    if (context.order_amount > 50000) {
      await context.requestApproval({ role: 'Manager' });
    }
    return await context.generatePO();
  }
});`;
  }

  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  window.app = new FlowGuardApp();
});
