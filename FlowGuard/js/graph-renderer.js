/**
 * FlowGuard AI - Interactive Workflow Graph Renderer (Step 4)
 * SVG + HTML5 Canvas with Hierarchical Layout, Bezier Connectors, Zoom/Pan & Node Dragging
 */

export class GraphRenderer {
  constructor(viewportEl, onNodeSelect) {
    this.viewport = viewportEl;
    this.onNodeSelect = onNodeSelect;
    
    this.canvas = this.viewport.querySelector('.graph-canvas');
    this.svgLayer = this.viewport.querySelector('.graph-svg-layer');
    this.nodesLayer = this.viewport.querySelector('.graph-nodes-layer');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    
    this.ast = null;
    this.nodePositions = new Map(); // id -> { x, y, width, height }
    this.selectedNodeId = null;
    
    // Transform State (Zoom & Pan)
    this.scale = 1;
    this.translateX = 60;
    this.translateY = 60;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    
    // Dragging Node State
    this.draggingNode = null;
    this.dragOffset = { x: 0, y: 0 };
    
    this.initEvents();
  }

  initEvents() {
    // Canvas Pan Events
    this.viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.wf-node') || e.target.closest('.graph-controls')) return;
      this.isPanning = true;
      this.panStartX = e.clientX - this.translateX;
      this.panStartY = e.clientY - this.translateY;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.translateX = e.clientX - this.panStartX;
        this.translateY = e.clientY - this.panStartY;
        this.updateTransform();
      } else if (this.draggingNode) {
        const rect = this.viewport.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.translateX) / this.scale;
        const mouseY = (e.clientY - rect.top - this.translateY) / this.scale;
        
        const pos = this.nodePositions.get(this.draggingNode.id);
        if (pos) {
          pos.x = mouseX - this.dragOffset.x;
          pos.y = mouseY - this.dragOffset.y;
          
          this.draggingNode.element.style.left = `${pos.x}px`;
          this.draggingNode.element.style.top = `${pos.y}px`;
          this.renderEdges();
          this.updateMinimap();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.draggingNode = null;
    });

    // Zoom on Wheel
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });
  }

  zoom(factor, clientX, clientY) {
    const prevScale = this.scale;
    const newScale = Math.min(Math.max(0.3, this.scale * factor), 2.2);
    
    if (clientX !== undefined && clientY !== undefined) {
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      
      this.translateX = mouseX - (mouseX - this.translateX) * (newScale / prevScale);
      this.translateY = mouseY - (mouseY - this.translateY) * (newScale / prevScale);
    }
    
    this.scale = newScale;
    this.updateTransform();
    this.updateMinimap();
  }

  updateTransform() {
    this.canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
  }

  resetView() {
    this.scale = 1;
    this.translateX = 80;
    this.translateY = 60;
    this.updateTransform();
    this.updateMinimap();
  }

  fitView() {
    if (!this.ast || this.ast.nodes.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodePositions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });

    const vWidth = this.viewport.clientWidth - 100;
    const vHeight = this.viewport.clientHeight - 100;
    const contentWidth = maxX - minX + 60;
    const contentHeight = maxY - minY + 60;

    const scale = Math.min(Math.max(0.4, Math.min(vWidth / contentWidth, vHeight / contentHeight)), 1.2);
    this.scale = scale;
    this.translateX = (this.viewport.clientWidth - contentWidth * scale) / 2 - minX * scale + 30;
    this.translateY = 60;
    
    this.updateTransform();
    this.updateMinimap();
  }

  /**
   * Render complete workflow AST into visual graph
   */
  render(ast, verificationResult = null) {
    this.ast = ast;
    this.nodesLayer.innerHTML = '';
    this.svgLayer.innerHTML = this.getDefsSVG();
    this.nodePositions.clear();

    if (!ast || !ast.nodes || ast.nodes.length === 0) return;

    // Calculate hierarchical DAG layout
    this.calculateHierarchicalLayout(ast);

    // Render HTML Nodes
    ast.nodes.forEach(node => {
      const pos = this.nodePositions.get(node.id);
      const nodeEl = this.createNodeElement(node, pos, verificationResult);
      this.nodesLayer.appendChild(nodeEl);
    });

    // Render SVG Connection Edges
    this.renderEdges();
    this.fitView();
  }

  getDefsSVG() {
    return `
      <defs>
        <marker id="arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
        </marker>
        <marker id="arrow-true" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
        </marker>
        <marker id="arrow-false" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
        </marker>
        <marker id="arrow-cycle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
        </marker>
      </defs>
    `;
  }

  calculateHierarchicalLayout(ast) {
    const nodeWidth = 270;
    const nodeHeight = 90;
    const verticalGap = 75;
    const horizontalGap = 160;

    // Build adjacency and depth ranks
    const inDegree = new Map();
    const childrenMap = new Map();
    ast.nodes.forEach(n => {
      inDegree.set(n.id, 0);
      childrenMap.set(n.id, []);
    });

    ast.edges.forEach(e => {
      if (childrenMap.has(e.from)) childrenMap.get(e.from).push(e.to);
      if (inDegree.has(e.to)) inDegree.set(e.to, inDegree.get(e.to) + 1);
    });

    // Determine levels via topological/BFS layer assignment
    const levels = [];
    const assigned = new Set();

    let currentLevel = ast.nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    if (currentLevel.length === 0 && ast.nodes.length > 0) {
      currentLevel = [ast.nodes[0].id];
    }

    while (currentLevel.length > 0) {
      levels.push(currentLevel);
      currentLevel.forEach(id => assigned.add(id));

      const nextLevel = new Set();
      currentLevel.forEach(id => {
        const nextNodes = childrenMap.get(id) || [];
        nextNodes.forEach(nxt => {
          if (!assigned.has(nxt)) nextLevel.add(nxt);
        });
      });
      currentLevel = Array.from(nextLevel);
    }

    // Include any remaining nodes (e.g. disconnected unreachable nodes)
    const unassigned = ast.nodes.filter(n => !assigned.has(n.id)).map(n => n.id);
    if (unassigned.length > 0) {
      levels.push(unassigned);
    }

    // Position nodes based on level ranks
    levels.forEach((levelNodes, lvlIndex) => {
      const levelWidth = levelNodes.length * nodeWidth + (levelNodes.length - 1) * horizontalGap;
      const startX = Math.max(80, 450 - levelWidth / 2);

      levelNodes.forEach((nodeId, idx) => {
        const x = startX + idx * (nodeWidth + horizontalGap);
        const y = 50 + lvlIndex * (nodeHeight + verticalGap);
        this.nodePositions.set(nodeId, { x, y, width: nodeWidth, height: nodeHeight });
      });
    });
  }

  createNodeElement(node, pos, verificationResult) {
    const el = document.createElement('div');
    el.className = `wf-node node-${node.color || 'blue'}`;
    el.id = `node-el-${node.id}`;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.style.width = `${pos.width}px`;

    // Check verification flags
    if (node.hasError || (verificationResult?.issues.some(i => i.severity === 'ERROR' && i.nodeIds?.includes(node.id)))) {
      el.classList.add('has-error');
    }
    if (node.hasWarning || (verificationResult?.issues.some(i => i.severity === 'WARNING' && i.nodeIds?.includes(node.id)))) {
      el.classList.add('has-warning');
    }

    const typeIcons = {
      TRIGGER: '⚡',
      CONDITION: '🔀',
      APPROVAL: '🛡️',
      AUTOMATION: '⚙️',
      PROCESS: '📦',
      END: '🏁'
    };

    const icon = typeIcons[node.type] || '🔹';

    el.innerHTML = `
      <div class="node-header">
        <span class="node-type-badge">${icon} ${node.type}</span>
        <span class="node-role-badge">👤 ${node.role || 'System'}</span>
      </div>
      <div class="node-body">
        <div class="node-title">${node.label}</div>
        <div class="node-details">
          ${node.conditionExpression ? `<span class="node-condition-pill">${node.conditionExpression}</span>` : ''}
          <span>${node.details || ''}</span>
        </div>
      </div>
      <div class="node-port port-in"></div>
      <div class="node-port port-out"></div>
    `;

    // Selection & Dragging Event Handlers
    el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.selectNode(node.id);
      
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - this.translateX) / this.scale;
      const mouseY = (e.clientY - rect.top - this.translateY) / this.scale;
      
      this.draggingNode = {
        id: node.id,
        element: el
      };
      this.dragOffset = {
        x: mouseX - pos.x,
        y: mouseY - pos.y
      };
    });

    return el;
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    document.querySelectorAll('.wf-node').forEach(n => n.classList.remove('selected'));
    const selectedEl = document.getElementById(`node-el-${nodeId}`);
    if (selectedEl) selectedEl.classList.add('selected');
    
    if (this.onNodeSelect && this.ast) {
      const node = this.ast.nodes.find(n => n.id === nodeId);
      if (node) this.onNodeSelect(node);
    }
  }

  renderEdges() {
    if (!this.ast || !this.ast.edges) return;
    
    let svgContent = this.getDefsSVG();

    this.ast.edges.forEach(edge => {
      const fromPos = this.nodePositions.get(edge.from);
      const toPos = this.nodePositions.get(edge.to);

      if (!fromPos || !toPos) return;

      const startX = fromPos.x + fromPos.width / 2;
      const startY = fromPos.y + fromPos.height;
      const endX = toPos.x + toPos.width / 2;
      const endY = toPos.y;

      let edgeClass = 'edge-path';
      let marker = 'url(#arrow-default)';

      if (edge.branch === 'true') {
        edgeClass += ' edge-true';
        marker = 'url(#arrow-true)';
      } else if (edge.branch === 'false') {
        edgeClass += ' edge-false';
        marker = 'url(#arrow-false)';
      }

      if (edge.isCycle) {
        edgeClass += ' edge-error-cycle';
        marker = 'url(#arrow-cycle)';
      }

      // Bezier curve calculation
      let pathD = '';
      if (edge.isCycle && startY > endY) {
        // Loop back curve on side
        const loopOffset = 180;
        pathD = `M ${startX} ${startY} C ${startX + loopOffset} ${startY + 60}, ${endX + loopOffset} ${endY - 60}, ${endX} ${endY}`;
      } else {
        const deltaY = endY - startY;
        const cpOffset = Math.max(30, deltaY * 0.45);
        pathD = `M ${startX} ${startY} C ${startX} ${startY + cpOffset}, ${endX} ${endY - cpOffset}, ${endX} ${endY}`;
      }

      const midX = (startX + endX) / 2 + (edge.isCycle ? 70 : 0);
      const midY = (startY + endY) / 2;

      svgContent += `
        <g class="edge-group" id="edge-${edge.id}">
          <path d="${pathD}" class="${edgeClass}" marker-end="${marker}" />
          ${edge.label ? `
            <g class="edge-label-container" transform="translate(${midX}, ${midY})">
              <rect x="-40" y="-10" width="80" height="20" rx="4" fill="#1f293d" stroke="rgba(255,255,255,0.1)" />
              <text class="edge-label ${edge.branch === 'true' ? 'true-branch' : ''} ${edge.branch === 'false' ? 'false-branch' : ''}" text-anchor="middle" dominant-baseline="middle">${edge.label}</text>
            </g>
          ` : ''}
        </g>
      `;
    });

    this.svgLayer.innerHTML = svgContent;
  }

  updateMinimap() {
    if (!this.minimapCanvas) return;
    const ctx = this.minimapCanvas.getContext('2d');
    const w = this.minimapCanvas.width = 160;
    const h = this.minimapCanvas.height = 100;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
    ctx.fillRect(0, 0, w, h);

    if (!this.ast || this.ast.nodes.length === 0) return;

    // Compute bounding box
    const mapScale = 0.07;
    const offsetX = 15;
    const offsetY = 15;

    ctx.fillStyle = '#3b82f6';
    this.nodePositions.forEach(pos => {
      ctx.fillRect(pos.x * mapScale + offsetX, pos.y * mapScale + offsetY, pos.width * mapScale, pos.height * mapScale);
    });
  }
}
