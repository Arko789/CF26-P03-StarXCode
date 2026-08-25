/**
 * FlowGuard AI - Live Interactive Workflow Execution Simulator
 * Animates glowing tokens across nodes, evaluates runtime condition logic & generates trace logs
 */

export class WorkflowSimulator {
  constructor(canvasContainer, onLogUpdate, onStepChange) {
    this.container = canvasContainer;
    this.onLogUpdate = onLogUpdate;
    this.onStepChange = onStepChange;

    this.ast = null;
    this.currentNodeId = null;
    this.isRunning = false;
    this.timer = null;
    this.stepIndex = 0;
    this.logs = [];

    // Runtime Mock State
    this.context = {
      order_amount: 65000,
      manager_decision: 'Approved',
      user_role: 'Employee'
    };

    this.tokenEl = null;
  }

  setContext(newCtx) {
    this.context = { ...this.context, ...newCtx };
  }

  loadWorkflow(ast) {
    this.ast = ast;
    this.reset();
  }

  reset() {
    this.stop();
    this.stepIndex = 0;
    this.logs = [];
    this.removeToken();
    document.querySelectorAll('.wf-node').forEach(n => n.classList.remove('sim-active-step'));
    
    if (this.onLogUpdate) this.onLogUpdate(this.logs);
    if (this.onStepChange) this.onStepChange(null);
  }

  start() {
    if (!this.ast || this.isRunning) return;
    this.reset();
    this.isRunning = true;
    
    // Find initial trigger node
    const startNode = this.ast.nodes.find(n => n.type === 'TRIGGER') || this.ast.nodes[0];
    if (!startNode) return;

    this.log('info', `🚀 Workflow Execution Initialized. Context: ${JSON.stringify(this.context)}`);
    this.executeStep(startNode.id);
  }

  step() {
    if (!this.ast) return;
    if (!this.currentNodeId) {
      const startNode = this.ast.nodes.find(n => n.type === 'TRIGGER') || this.ast.nodes[0];
      if (startNode) this.executeStep(startNode.id);
    } else {
      const nextId = this.computeNextStep(this.currentNodeId);
      if (nextId) {
        this.executeStep(nextId);
      } else {
        this.log('end', '🏁 Workflow reached terminal state. Execution complete.');
        this.stop();
      }
    }
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  executeStep(nodeId) {
    this.currentNodeId = nodeId;
    const node = this.ast.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Highlight node in DOM
    document.querySelectorAll('.wf-node').forEach(n => n.classList.remove('sim-active-step'));
    const nodeEl = document.getElementById(`node-el-${nodeId}`);
    if (nodeEl) {
      nodeEl.classList.add('sim-active-step');
      this.moveTokenToNode(nodeEl, node);
    }

    if (this.onStepChange) this.onStepChange(node);

    // Evaluate logic per node type
    switch (node.type) {
      case 'TRIGGER':
        this.log('info', `[Step ${node.metadata?.stepIndex || 1}] Triggered: ${node.label}`);
        break;

      case 'CONDITION': {
        const thresholdMatch = node.conditionExpression?.match(/>\s*(\d+)/) || node.label.match(/>\s*([₹$€]?\s*\d[\d,]*)/);
        let threshold = 50000;
        if (thresholdMatch && thresholdMatch[1]) {
          threshold = parseInt(thresholdMatch[1].replace(/[^\d]/g, ''), 10);
        }

        const isConditionMet = this.context.order_amount > threshold;
        this.log('decision', `[Condition] Evaluated: order_amount (${this.context.order_amount}) > ${threshold} => ${isConditionMet ? 'TRUE (Exceeds Threshold)' : 'FALSE (Within Limits)'}`);
        break;
      }

      case 'APPROVAL':
        this.log('info', `[Approval Gate] Role: ${node.role || 'Manager'} - Decision: ${this.context.manager_decision}`);
        break;

      case 'AUTOMATION':
        this.log('success', `[System Action] Executed: ${node.label}`);
        break;

      case 'END':
        this.log('end', `[Workflow Terminated] Status: ${node.label}`);
        break;

      default:
        this.log('info', `[Processing] Executing ${node.label}`);
        break;
    }

    // Auto-advance if in continuous running mode
    if (this.isRunning) {
      this.timer = setTimeout(() => {
        const nextId = this.computeNextStep(nodeId);
        if (nextId && this.isRunning) {
          this.executeStep(nextId);
        } else {
          this.log('end', '🏁 Workflow finished successfully with status 200 OK.');
          this.stop();
        }
      }, 1400);
    }
  }

  computeNextStep(currentNodeId) {
    const node = this.ast.nodes.find(n => n.id === currentNodeId);
    if (!node) return null;

    const outEdges = this.ast.edges.filter(e => e.from === currentNodeId);
    if (outEdges.length === 0) return null;

    // If condition node, evaluate true vs false branch
    if (node.type === 'CONDITION') {
      const thresholdMatch = node.conditionExpression?.match(/>\s*(\d+)/) || node.label.match(/>\s*([₹$€]?\s*\d[\d,]*)/);
      let threshold = 50000;
      if (thresholdMatch && thresholdMatch[1]) {
        threshold = parseInt(thresholdMatch[1].replace(/[^\d]/g, ''), 10);
      }
      const isMet = this.context.order_amount > threshold;
      
      const targetEdge = outEdges.find(e => isMet ? (e.branch === 'true' || e.label?.toLowerCase().includes('yes')) : (e.branch === 'false' || e.label?.toLowerCase().includes('no')));
      return targetEdge ? targetEdge.to : outEdges[0].to;
    }

    // If approval node and manager decision is rejected
    if (node.type === 'APPROVAL' && this.context.manager_decision === 'Rejected') {
      const rejectEdge = outEdges.find(e => e.label?.toLowerCase().includes('reject'));
      if (rejectEdge) return rejectEdge.to;
    }

    // Default to first output edge
    return outEdges[0].to;
  }

  moveTokenToNode(nodeEl, node) {
    if (!this.tokenEl) {
      this.tokenEl = document.createElement('div');
      this.tokenEl.className = 'sim-token';
      this.container.querySelector('.graph-canvas').appendChild(this.tokenEl);
    }

    const left = parseFloat(nodeEl.style.left) + nodeEl.offsetWidth / 2;
    const top = parseFloat(nodeEl.style.top) + nodeEl.offsetHeight / 2;

    this.tokenEl.style.left = `${left}px`;
    this.tokenEl.style.top = `${top}px`;
  }

  removeToken() {
    if (this.tokenEl && this.tokenEl.parentNode) {
      this.tokenEl.parentNode.removeChild(this.tokenEl);
      this.tokenEl = null;
    }
  }

  log(type, message) {
    const time = new Date().toLocaleTimeString();
    this.logs.unshift({ type, message, time });
    if (this.onLogUpdate) {
      this.onLogUpdate(this.logs);
    }
  }
}
