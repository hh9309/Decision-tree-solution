import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, AlertCircle, HelpCircle, Eye, EyeOff, X, Sliders, Trash2, Check, Scale, Copy, Workflow } from 'lucide-react';
import { DecisionTree, DecisionTreeNode } from '../types';
import { layoutTree } from '../treeEngine';

export const COLOR_THEMES = [
  { id: 'default', label: '默认分类', hex: '', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600', dot: 'bg-slate-400', activeRing: 'ring-slate-400' },
  { id: 'red', label: '高风险 / 警告', hex: '#ef4444', bg: 'bg-red-50 text-red-700', border: 'border-red-200', text: 'text-red-600', dot: 'bg-red-500', activeRing: 'ring-red-500' },
  { id: 'emerald', label: '乐观预测 / 收益', hex: '#10b981', bg: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-500', activeRing: 'ring-emerald-500' },
  { id: 'amber', label: '稳妥中庸 / 保守', hex: '#f59e0b', bg: 'bg-amber-50 text-amber-700', border: 'border-amber-200', text: 'text-amber-600', dot: 'bg-amber-500', activeRing: 'ring-amber-500' },
];

interface TopologyCanvasProps {
  tree: DecisionTree;
  solvedNodes: Record<string, DecisionTreeNode>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onUpdateNode?: (id: string, updates: Partial<DecisionTreeNode>) => void;
  onUpdateNodes?: (updates: Record<string, Partial<DecisionTreeNode>>) => void;
  onDeleteNode?: (id: string) => void;
  onCloneBranch?: (id: string) => void;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  tree,
  solvedNodes,
  selectedNodeId,
  onSelectNode,
  onUpdateNode,
  onUpdateNodes,
  onDeleteNode,
  onCloneBranch
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState<boolean>(true);
  
  // Custom node positions state & drag-to-rearrange states
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const dragNodeStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nodeStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Branch Comparison Mode states
  const [compareModeActive, setCompareModeActive] = useState<boolean>(false);
  const [compareNodeAId, setCompareNodeAId] = useState<string | null>(null);
  const [compareNodeBId, setCompareNodeBId] = useState<string | null>(null);

  // Helper to trace if a node is descendant of an ancestor node
  const isDescendantOf = (nodeId: string, ancestorId: string | null): boolean => {
    if (!ancestorId) return false;
    if (nodeId === ancestorId) return true;
    let current = tree.nodes[nodeId];
    while (current && current.parentId) {
      if (current.parentId === ancestorId) return true;
      current = tree.nodes[current.parentId];
    }
    return false;
  };
  
  // Autocomplete suggestions focus state
  const [inputFocused, setInputFocused] = useState<boolean>(false);

  // Slide settings editor state
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Default coordinate space
  const canvasWidth = 850;
  const canvasHeight = 480;

  // Compute Layout positions dynamically
  const { nodes: layoutCoords, maxDepth } = layoutTree(tree, canvasWidth, canvasHeight);

  // Common comparison calculations
  const emvA = compareNodeAId ? (solvedNodes[compareNodeAId]?.emv ?? tree.nodes[compareNodeAId]?.payoff ?? 0) : 0;
  const emvB = compareNodeBId ? (solvedNodes[compareNodeBId]?.emv ?? tree.nodes[compareNodeBId]?.payoff ?? 0) : 0;
  const emvDiff = emvA - emvB;
  const winnerNodeId = compareNodeAId && compareNodeBId 
    ? (emvA >= emvB ? compareNodeAId : compareNodeBId) 
    : null;

  // Helper to retrieve node coordinates (with custom layout drag override support)
  const getNodeCoords = (id: string) => {
    if (nodePositions[id]) {
      return nodePositions[id];
    }
    return layoutCoords[id] || { x: 0, y: 0 };
  };

  // Reorganize back to standard, clean hierarchical layout structure
  const handleAutoLayout = () => {
    setNodePositions({});
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Sync selection to open / close side editor panel on connections
  useEffect(() => {
    if (selectedNodeId) {
      const selectedNode = tree.nodes[selectedNodeId];
      // Show side editor panel if selected node has parent (it is a branch connection)
      if (selectedNode && selectedNode.parentId) {
        setEditingLinkId(selectedNodeId);
      } else {
        setEditingLinkId(null);
      }
    } else {
      setEditingLinkId(null);
    }
    setDeleteConfirmId(null);
  }, [selectedNodeId, tree]);

  // Clear selections if empty space of canvas is clicked
  const handleBgClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectNode(null);
    }
  };

  // Zoom helpers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.45));
  const handleResetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Drag-to-pan and node-dragging handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return; // left click only
    e.stopPropagation(); // prevent background click or canvas pan triggering
    
    const initialCoords = getNodeCoords(nodeId);
    nodeStartPosRef.current = initialCoords;
    dragNodeStartRef.current = { x: e.clientX, y: e.clientY };
    setDraggedNodeId(nodeId);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    // Avoid dragging if clicking a node
    if ((e.target as SVGElement).closest('.node-element')) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      const dx = e.clientX - dragNodeStartRef.current.x;
      const dy = e.clientY - dragNodeStartRef.current.y;
      setNodePositions(prev => ({
        ...prev,
        [draggedNodeId]: {
          x: nodeStartPosRef.current.x + dx / zoom,
          y: nodeStartPosRef.current.y + dy / zoom
        }
      }));
      return;
    }
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNodeId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom(prev => Math.max(0.45, Math.min(prev * factor, 2.5)));
  };

  // Build formula text on hover
  const getFormulaText = (id: string): string => {
    const node = solvedNodes[id];
    if (!node) return '';

    const children = (Object.values(solvedNodes) as DecisionTreeNode[]).filter(n => n.parentId === id);
    if (node.type === 'TERMINAL' || children.length === 0) {
      return `EMV = ¥ ${node.payoff ?? 0}万 (结局终值)`;
    }

    if (node.type === 'CHANCE') {
      const parts = children.map(c => `(${c.probability ?? 0} × ${(c.emv ?? 0) - (c.cost ?? 0)})`);
      const val = parts.join(' + ');
      return `期望公式：Σ (P × (EMV - 成本))\n= ${val}\n= ¥ ${node.emv}万`;
    } else {
      // DECISION
      const optimalChild = children.find(c => !c.isPruned);
      const subParts = children.map(c => `[${c.name}: ${(c.emv ?? 0) - (c.cost ?? 0)}万]`);
      let text = `决策公式：max(子分支折现)\n= max( ${subParts.join(', ')} )\n= ¥ ${node.emv}万`;
      if (optimalChild) {
        text += `\n\n🎯 推荐最优决策：\n👉 【${optimalChild.name}】\n(折现价值: ¥ ${(optimalChild.emv ?? 0) - (optimalChild.cost ?? 0)}万)`;
      }
      return text;
    }
  };

  // Check if a decision node is high risk (EMV close to 0 or negative)
  const isHighRiskDecisionNode = (n: DecisionTreeNode, solvedN: DecisionTreeNode) => {
    if (n.type !== 'DECISION') return false;
    if (solvedN.emv === undefined) return false;
    if (n.enableRiskWarning) {
      return solvedN.emv <= (n.riskThreshold ?? 0);
    }
    return solvedN.emv <= 5;
  };

  // Dynamic values computation for the editing side panel
  const editingNode = editingLinkId ? tree.nodes[editingLinkId] : null;
  const parentNode = editingNode?.parentId ? tree.nodes[editingNode.parentId] : null;
  const siblings = editingNode && parentNode
    ? (Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.parentId === parentNode.id && n.id !== editingNode.id)
    : [];

  const siblingsAll = parentNode
    ? (Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.parentId === parentNode.id)
    : [];

  const totalProb = siblingsAll.reduce((acc, curr) => acc + (curr.probability || 0), 0);
  const totalProbPercent = Math.round(totalProb * 100);

  // Get all unique branch names currently in the tree
  const treeBranchNames = Array.from(
    new Set(
      (Object.values(tree.nodes) as DecisionTreeNode[])
        .map((n) => n.name.trim())
        .filter((name) => name && name !== editingNode?.name)
    )
  );

  // Default common high-quality business/chance labels
  const defaultLabels = [
    "高需求", "中需求", "低需求", 
    "高定价", "中定价", "低定价",
    "成功", "失败", 
    "追加投资", "保持原状", "放弃项目",
    "外包研发", "自主研发", "联合开发",
    "开拓国际市场", "深耕国内市场"
  ];

  // Combine tree names and default names
  const allSuggestions = Array.from(new Set([...treeBranchNames, ...defaultLabels]));

  // Filter based on current input text
  const currentVal = editingNode?.name || '';
  const filteredSuggestions = allSuggestions.filter(s =>
    s.toLowerCase().includes(currentVal.toLowerCase()) && s !== currentVal
  ).slice(0, 5);

  // Probability quick fixes
  const handleEqualDistribute = () => {
    if (!onUpdateNodes || !siblingsAll.length) return;
    const count = siblingsAll.length;
    const share = Math.round((1.0 / count) * 100) / 100;
    
    const updates: Record<string, Partial<DecisionTreeNode>> = {};
    siblingsAll.forEach((n, idx) => {
      if (idx === count - 1) {
        let sumPrev = 0;
        siblingsAll.slice(0, -1).forEach(() => { sumPrev += share; });
        updates[n.id] = { probability: Math.max(0, Math.round((1.0 - sumPrev) * 100) / 100) };
      } else {
        updates[n.id] = { probability: share };
      }
    });
    onUpdateNodes(updates);
  };

  const handleProRataNormalize = () => {
    if (!onUpdateNodes || !siblingsAll.length) return;
    const sum = siblingsAll.reduce((acc, curr) => acc + (curr.probability || 0), 0);
    if (sum === 0) return;
    
    const scale = 1.0 / sum;
    const updates: Record<string, Partial<DecisionTreeNode>> = {};
    let runningSum = 0;
    siblingsAll.forEach((n, idx) => {
      if (idx === siblingsAll.length - 1) {
        updates[n.id] = { probability: Math.max(0, Math.round((1.0 - runningSum) * 100) / 100) };
      } else {
        const val = Math.round((n.probability || 0) * scale * 100) / 100;
        runningSum += val;
        updates[n.id] = { probability: val };
      }
    });
    onUpdateNodes(updates);
  };

  const handleFillRemaining = () => {
    if (!onUpdateNode || !editingNode || !parentNode) return;
    const sumSibs = siblings.reduce((acc, curr) => acc + (curr.probability || 0), 0);
    const needed = Math.max(0, Math.round((1.0 - sumSibs) * 100) / 100);
    onUpdateNode(editingNode.id, { probability: needed });
  };

  // Branch path integrity verification helper
  const getChildrenProbSum = (nodeId: string): number => {
    const children = (Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.parentId === nodeId);
    return children.reduce((acc, curr) => acc + (curr.probability || 0), 0);
  };

  const isChanceNodeAndInvalid = (node: DecisionTreeNode): boolean => {
    if (node.type !== 'CHANCE') return false;
    const children = (Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.parentId === node.id);
    if (children.length === 0) return false;
    const sum = children.reduce((acc, curr) => acc + (curr.probability || 0), 0);
    return Math.abs(sum - 1.0) > 0.001;
  };

  const handleFixChanceNodeProbabilities = (chanceNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateNodes) return;
    const children = (Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.parentId === chanceNodeId);
    if (children.length === 0) return;

    const count = children.length;
    // Calculate equal share
    const share = Math.round((1.0 / count) * 100) / 100;
    
    const updates: Record<string, Partial<DecisionTreeNode>> = {};
    children.forEach((n, idx) => {
      if (idx === count - 1) {
        let sumPrev = 0;
        children.slice(0, -1).forEach(() => { sumPrev += share; });
        updates[n.id] = { probability: Math.max(0, Math.round((1.0 - sumPrev) * 100) / 100) };
      } else {
        updates[n.id] = { probability: share };
      }
    });
    onUpdateNodes(updates);
  };

  return (
    <div 
      id="canvas-card" 
      className={`bg-[#FAFBFD] border border-slate-200 p-4 relative flex flex-col overflow-hidden transition-all ${
        isFullscreen 
          ? 'fixed inset-0 z-50 w-screen h-screen rounded-none p-6 shadow-2xl bg-white' 
          : 'rounded-xl h-[520px]'
      }`}
    >
      
      {/* Minimal grid paper overlay */}
      <div className="absolute inset-0 opacity-[0.03] select-none pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      {/* Header controls inside canvas */}
      <div className={`flex justify-between items-center z-10 bg-white/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/50 absolute left-4 right-4 shadow-sm text-xs transition-all ${
        isFullscreen ? 'top-6 left-6 right-6' : 'top-4'
      }`}>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            🌍 拓扑建模推演画布
          </span>
          <div className="hidden sm:flex items-center gap-3 text-slate-400 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-orange-500 rounded-xs" /> 决策 (■)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" /> 机会 (●)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px] border-b-green-500" /> 结局 (▲)
            </span>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-2">
          {editingLinkId && (
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md font-medium border border-indigo-100 flex items-center gap-1 animate-pulse">
              <span>✍️ 正在配置路径属性</span>
            </span>
          )}

          <button
            id="btn-auto-layout"
            onClick={handleAutoLayout}
            className="p-1 px-2.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-100/70 text-[11px] flex items-center gap-1 cursor-pointer font-medium shadow-2xs transition-all"
            title="一键自动树状重排，使结构井然有序"
          >
            <Workflow className="w-3.5 h-3.5 text-indigo-500" />
            <span>自动重排</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-200" />

          <button
            id="btn-zoom-in"
            onClick={handleZoomIn}
            className="p-1 px-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-zoom-out"
            onClick={handleZoomOut}
            className="p-1 px-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-reset-zoom"
            onClick={handleResetZoom}
            className="p-1 px-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-[11px] flex items-center gap-1 cursor-pointer"
            title="居中重置"
          >
            <Maximize2 className="w-3 h-3" />
            <span>100%</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-200" />

          <button
            id="btn-toggle-fullscreen"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 px-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-[11px] flex items-center gap-1.5 cursor-pointer font-semibold shadow-xs transition-all"
            title={isFullscreen ? "退出全屏" : "全屏展开画布"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? "退出全屏" : "全屏展开"}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas wrapper with mouse controllers */}
      <div
        id="canvas-gesture-container"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleBgClick}
        className={`flex-1 overflow-hidden relative select-none rounded-xl ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <svg
          id="svg-topo-modeling-canvas"
          width="100%"
          height="100%"
          className="bg-slate-50"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* DEFINITIONS AND GLOW FILTERS */}
          <defs>
            {/* Glowing neon stroke for golden/active paths */}
            <filter id="neon-glow-filter" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Marker definitions for directional arrows */}
            <marker
              id="arrow-unpruned"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>

            <marker
              id="arrow-golden"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>

            <marker
              id="arrow-pruned"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#cbd5e1" />
            </marker>
          </defs>

          {/* 1. LAYER ONE: THE CONNECTING BRANCH ARROWS */}
          <g id="layer-connections">
            {(Object.values(tree.nodes) as DecisionTreeNode[]).map(childNode => {
              if (!childNode.parentId) return null;
              
              const parentNode = tree.nodes[childNode.parentId];
              if (!parentNode) return null;

              const start = getNodeCoords(parentNode.id);
              const end = getNodeCoords(childNode.id);
              if (!start || !end) return null;

              const isLinkEditingNow = editingLinkId === childNode.id;

              // Compute dynamic solver parameters to check if golden or pruned
              const solvedChild = solvedNodes[childNode.id];
              const isPruned = solvedChild?.isPruned;
              const isGolden = !isPruned && (solvedNodes[parentNode.id]?.isPruned === false || parentNode.id === 'root');

              // Determine comparison mode overrides for links
              const inA = compareModeActive && isDescendantOf(childNode.id, compareNodeAId);
              const inB = compareModeActive && isDescendantOf(childNode.id, compareNodeBId);
              
              const emvA = compareNodeAId ? (solvedNodes[compareNodeAId]?.emv ?? tree.nodes[compareNodeAId]?.payoff ?? 0) : 0;
              const emvB = compareNodeBId ? (solvedNodes[compareNodeBId]?.emv ?? tree.nodes[compareNodeBId]?.payoff ?? 0) : 0;
              const winnerNodeId = compareNodeAId && compareNodeBId 
                ? (emvA >= emvB ? compareNodeAId : compareNodeBId) 
                : null;
              const isWinnerBranch = compareModeActive && winnerNodeId && isDescendantOf(childNode.id, winnerNodeId);

              let linkStroke = isLinkEditingNow ? '#4f46e5' : isGolden ? '#059669' : isPruned ? '#cbd5e1' : '#000000';
              let linkWidth = isLinkEditingNow ? 6 : isGolden ? 5 : isPruned ? 2 : 3.5;
              let linkDash = isPruned ? '4,4' : undefined;
              let linkFilter = isGolden || isLinkEditingNow ? 'url(#neon-glow-filter)' : undefined;

              if (compareModeActive) {
                if (inA || inB) {
                  if (isWinnerBranch) {
                    // Winner branch gets premium vibrant highlight!
                    linkStroke = '#10b981'; // Radiant emerald green
                    linkWidth = 6.5;
                    linkFilter = 'url(#neon-glow-filter)';
                  } else {
                    // Loser/suboptimal branch gets dimmed, dashed, colored line
                    linkStroke = inA ? '#93c5fd' : '#e9d5ff';
                    linkWidth = 3.5;
                    linkDash = '4,4';
                    linkFilter = undefined;
                  }
                } else {
                  // Not in either compared branch - make it very faint to draw focus
                  if (compareNodeAId || compareNodeBId) {
                    linkStroke = '#e2e8f0';
                    linkWidth = 1.5;
                    linkFilter = undefined;
                  }
                }
              }

              // Draw Bezier Curve Connector
              const helperOffset = (end.x - start.x) / 2;
              const pathD = `M ${start.x} ${start.y} C ${start.x + helperOffset} ${start.y}, ${end.x - helperOffset} ${end.y}, ${end.x} ${end.y}`;

              // Branch probabilities label positioning (center of bezier path)
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2 - 8;

              return (
                <g key={`link-${childNode.id}`} className="transition-all">
                  
                  {/* Bezier stroke container (visible line) */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={linkStroke}
                    strokeWidth={linkWidth}
                    strokeDasharray={linkDash}
                    filter={linkFilter}
                    markerEnd={isLinkEditingNow ? 'url(#arrow-golden)' : isGolden ? 'url(#arrow-golden)' : isPruned ? 'url(#arrow-pruned)' : 'url(#arrow-unpruned)'}
                    className="transition-all duration-300"
                  />

                  {/* Thick transparent path for super easy selection target */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="cursor-pointer hover:stroke-indigo-500/10 transition-all duration-150"
                    onMouseEnter={() => {
                      if (parentNode.type === 'DECISION' && isGolden) {
                        setHoveredNodeId(parentNode.id);
                      }
                    }}
                    onMouseLeave={() => {
                      if (parentNode.type === 'DECISION' && isGolden) {
                        setHoveredNodeId(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(childNode.id);
                    }}
                  />

                  {/* Draw scissor marker on pruned branch */}
                  {isPruned && (
                    <g transform={`translate(${midX}, ${midY + 12}) scale(0.8)`}>
                      <circle cx="0" cy="0" r="8" fill="#fee2e2" />
                      <text x="0" y="3" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">✂️</text>
                    </g>
                  )}

                  {/* Golden optimal choice badge */}
                  {parentNode.type === 'DECISION' && isGolden && (
                    <g
                      transform={`translate(${midX}, ${midY - 14})`}
                      className="cursor-pointer select-none"
                      onMouseEnter={() => setHoveredNodeId(parentNode.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      <rect
                        x="-24"
                        y="-6"
                        width="48"
                        height="12"
                        rx="3"
                        fill="#f59e0b"
                        className="animate-pulse"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(childNode.id);
                        }}
                      />
                      <text
                        x="0"
                        y="3"
                        fontSize="8"
                        fontWeight="extrabold"
                        textAnchor="middle"
                        fill="#ffffff"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(childNode.id);
                        }}
                      >
                        ★ 最优决策
                      </text>
                    </g>
                  )}

                  {/* Branch Labels (P & Cost) */}
                  <g transform={`translate(${midX}, ${midY})`} className="cursor-pointer select-none">
                    {/* Background capsule */}
                    <rect
                      x="-45"
                      y="-12"
                      width="90"
                      height="20"
                      rx="6"
                      fill="#ffffff"
                      stroke={isLinkEditingNow ? '#4f46e5' : isGolden ? '#059669' : '#000000'}
                      strokeWidth={isLinkEditingNow ? '3' : '2'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(childNode.id);
                      }}
                      className="shadow-sm hover:stroke-indigo-600 transition-all"
                    />

                    <text
                      x="0"
                      y="1.5"
                      fontSize="9.5"
                      fontWeight="black"
                      textAnchor="middle"
                      fill={isLinkEditingNow ? '#4f46e5' : isPruned ? '#475569' : '#000000'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(childNode.id);
                      }}
                    >
                      {/* Name if any plus Prob or Cost */}
                      {parentNode.type === 'CHANCE' 
                        ? `P=${Math.round((childNode.probability || 0) * 100)}%`
                        : childNode.cost 
                          ? `-¥${childNode.cost}万`
                          : '选择'}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* 2. LAYER TWO: THE GRAPH NODES */}
          <g id="layer-nodes">
            {Object.keys(layoutCoords).map((id) => {
              const node = tree.nodes[id];
              if (!node) return null;

              const coord = getNodeCoords(id);
              const solvedNode = solvedNodes[id] || node;
              const isSelected = selectedNodeId === id;
              const isPruned = solvedNode.isPruned;

              const themeColor = node.colorTheme && node.colorTheme !== 'default'
                ? COLOR_THEMES.find(t => t.id === node.colorTheme)?.hex
                : null;

              const handleNodeClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (compareModeActive) {
                  if (!compareNodeAId) {
                    setCompareNodeAId(id);
                  } else if (compareNodeAId === id) {
                    setCompareNodeAId(null);
                  } else if (!compareNodeBId) {
                    setCompareNodeBId(id);
                  } else if (compareNodeBId === id) {
                    setCompareNodeBId(null);
                  } else {
                    setCompareNodeBId(id);
                  }
                } else {
                  onSelectNode(id);
                }
              };

              const inA_node = compareModeActive && isDescendantOf(id, compareNodeAId);
              const inB_node = compareModeActive && isDescendantOf(id, compareNodeBId);

              // Calculate overall opacity for nodes
              let nodeOpacity = 1;
              if (compareModeActive && (compareNodeAId || compareNodeBId)) {
                if (id === compareNodeAId || id === compareNodeBId || inA_node || inB_node) {
                  nodeOpacity = 1;
                } else {
                  nodeOpacity = 0.22; // Dim out unrelated nodes
                }
              }

              return (
                <g
                  key={`node-${id}`}
                  className="node-element group transition-all duration-300 cursor-pointer"
                  transform={`translate(${coord.x}, ${coord.y})`}
                  style={{ opacity: nodeOpacity }}
                  onClick={handleNodeClick}
                  onMouseDown={(e) => handleNodeMouseDown(e, id)}
                  onMouseEnter={() => setHoveredNodeId(id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  
                  {/* Selection Indicator Ring */}
                  {isSelected && (
                    <circle
                      cx="0"
                      cy="0"
                      r="25"
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2.5"
                      strokeDasharray="4,2"
                      className="animate-spin"
                      style={{ animationDuration: '8s' }}
                    />
                  )}

                  {/* Compare mode double rings */}
                  {compareModeActive && id === compareNodeAId && (
                    <g>
                      <circle
                        cx="0"
                        cy="0"
                        r="28"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        className="animate-pulse"
                      />
                      <circle
                        cx="0"
                        cy="0"
                        r="23"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}
                  {compareModeActive && id === compareNodeBId && (
                    <g>
                      <circle
                        cx="0"
                        cy="0"
                        r="28"
                        fill="none"
                        stroke="#d946ef"
                        strokeWidth="3"
                        className="animate-pulse"
                      />
                      <circle
                        cx="0"
                        cy="0"
                        r="23"
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}

                  {/* Compare mode badge labels */}
                  {compareModeActive && id === compareNodeAId && (
                    <g transform="translate(0, -48)">
                      <rect
                        x="-32"
                        y="-8"
                        width="64"
                        height="16"
                        rx="4"
                        fill="#2563eb"
                        className="shadow-sm"
                      />
                      <text
                        x="0"
                        y="3"
                        fontSize="8"
                        fontWeight="extrabold"
                        textAnchor="middle"
                        fill="#ffffff"
                      >
                        🅰️ 分支 A
                      </text>
                      {winnerNodeId === compareNodeAId && (
                        <g transform="translate(0, -14)">
                          <circle cx="0" cy="0" r="7" fill="#eab308" />
                          <text x="0" y="2.5" fontSize="7" textAnchor="middle" fill="#ffffff" fontWeight="black">🏆</text>
                        </g>
                      )}
                    </g>
                  )}

                  {compareModeActive && id === compareNodeBId && (
                    <g transform="translate(0, -48)">
                      <rect
                        x="-32"
                        y="-8"
                        width="64"
                        height="16"
                        rx="4"
                        fill="#c084fc"
                        className="shadow-sm"
                      />
                      <text
                        x="0"
                        y="3"
                        fontSize="8"
                        fontWeight="extrabold"
                        textAnchor="middle"
                        fill="#ffffff"
                      >
                        🅱️ 分支 B
                      </text>
                      {winnerNodeId === compareNodeBId && (
                        <g transform="translate(0, -14)">
                          <circle cx="0" cy="0" r="7" fill="#eab308" />
                          <text x="0" y="2.5" fontSize="7" textAnchor="middle" fill="#ffffff" fontWeight="black">🏆</text>
                        </g>
                      )}
                    </g>
                  )}

                  {/* High Quality Node Shapes */}
                  {node.type === 'DECISION' && (
                    <rect
                      x="-13"
                      y="-13"
                      width="26"
                      height="26"
                      rx="5"
                      fill={isPruned ? '#cbd5e1' : themeColor ? themeColor : '#f97316'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="shadow-sm border border-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] group-hover:scale-110 transition-transform duration-200"
                    />
                  )}

                  {node.type === 'CHANCE' && (
                    <circle
                      cx="0"
                      cy="0"
                      r="14"
                      fill={isPruned ? '#cbd5e1' : themeColor ? themeColor : '#3b82f6'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="shadow-sm filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] group-hover:scale-110 transition-transform duration-200"
                    />
                  )}

                  {node.type === 'TERMINAL' && (
                     <polygon
                      points="0,-14 13,11 -13,11"
                      fill={isPruned ? '#cbd5e1' : themeColor ? themeColor : '#22c55e'}
                      stroke="#ffffff"
                      strokeWidth="2"
                      transform="rotate(90)"
                      className="shadow-sm filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] group-hover:scale-110 transition-transform duration-200"
                    />
                  )}

                  {/* EMV Capsule Badge directly underneath the node symbol */}
                  {solvedNode.emv !== undefined && (
                    <g transform="translate(0, 24)">
                      <rect
                        x="-30"
                        y="-7.5"
                        width="60"
                        height="15"
                        rx="4"
                        fill="#1e293b"
                        opacity={isPruned ? 0.35 : 0.9}
                        className="shadow-sm"
                      />
                      <text
                        x="0"
                        y="3"
                        fontSize="8.5"
                        fontWeight="extrabold"
                        fontFamily="monospace"
                        textAnchor="middle"
                        fill="#34d399"
                      >
                        ¥{solvedNode.emv}w
                      </text>
                    </g>
                  )}

                  {/* Text Title (Node Name) above node */}
                  <g transform="translate(0, -22)">
                    <text
                      x="0"
                      y="1"
                      fontSize="11"
                      fontWeight={isSelected ? 'black' : 'extrabold'}
                      textAnchor="middle"
                      fill={isPruned ? '#475569' : '#000000'}
                      className="select-none bg-white/95 px-2 py-0.5 rounded-md font-sans font-bold shadow-3xs border border-slate-100"
                    >
                      {node.name}
                    </text>
                  </g>

                  {/* Category Label Capsule above name */}
                  {themeColor && (
                    <g transform="translate(0, -35)">
                      <rect
                        x="-22"
                        y="-6"
                        width="44"
                        height="12"
                        rx="4"
                        fill={themeColor}
                        opacity="0.12"
                      />
                      <rect
                        x="-22"
                        y="-6"
                        width="44"
                        height="12"
                        rx="4"
                        fill="none"
                        stroke={themeColor}
                        strokeWidth="0.8"
                        opacity="0.8"
                      />
                      <text
                        x="0"
                        y="3"
                        fontSize="7.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        fill={themeColor}
                        className="select-none font-sans"
                      >
                        {COLOR_THEMES.find(t => t.id === node.colorTheme)?.label?.split(' / ')[0] || ''}
                      </text>
                    </g>
                  )}

                  {/* Interactive Branch Integrity Warning Red Dot for CHANCE node with unequal probabilities */}
                  {isChanceNodeAndInvalid(node) && (
                    <g
                      transform="translate(0, -36)"
                      className="cursor-pointer"
                      onClick={(e) => handleFixChanceNodeProbabilities(node.id, e)}
                    >
                      {/* Outer pulsing shadow circle */}
                      <circle
                        cx="0"
                        cy="0"
                        r="6"
                        fill="#ef4444"
                        opacity="0.5"
                        className="animate-ping"
                      />
                      {/* Base warning red circle */}
                      <circle
                        cx="0"
                        cy="0"
                        r="4.5"
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                      {/* White exclamation mark */}
                      <text
                        x="0"
                        y="1.5"
                        fontSize="6.5"
                        fontWeight="extrabold"
                        textAnchor="middle"
                        fill="#ffffff"
                        className="select-none"
                      >
                        !
                      </text>
                      <title>{`子分支概率和不等于100% (当前合计: ${Math.round(getChildrenProbSum(node.id) * 100)}%)，点击一键均分补齐概率`}</title>
                    </g>
                  )}

                  {/* High-Risk Decision Node Warning Badge */}
                  {isHighRiskDecisionNode(node, solvedNode) && (
                    <g
                      transform="translate(14, -14)"
                      className="cursor-pointer group/risk"
                    >
                      {/* Outer pulsing ring */}
                      <circle
                        cx="0"
                        cy="0"
                        r="6"
                        fill="#ef4444"
                        opacity="0.4"
                        className="animate-ping"
                      />
                      {/* Solid red warning circle */}
                      <circle
                        cx="0"
                        cy="0"
                        r="5.5"
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      {/* Small white alert mark ! */}
                      <text
                        x="0"
                        y="2.2"
                        fontSize="7.5"
                        fontWeight="black"
                        textAnchor="middle"
                        fill="#ffffff"
                        className="select-none font-sans"
                      >
                        !
                      </text>
                      <title>{`高风险路径警告: 当前期望收益(EMV)为 ¥${solvedNode.emv}万，低于安全临界值(设为: ${node.enableRiskWarning ? (node.riskThreshold ?? 0) : 5}万)`}</title>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* 3. LAYER THREE: LIVE EXPLANATORY HOVER tooltips */}
        {showFormula && hoveredNodeId && solvedNodes[hoveredNodeId] && (
          (() => {
            const coords = getNodeCoords(hoveredNodeId);
            const leftPx = coords.x * zoom + panX;
            const topPx = coords.y * zoom + panY;
            const node = solvedNodes[hoveredNodeId];
            const rawNode = tree.nodes[hoveredNodeId] || node;
            const isHighRisk = isHighRiskDecisionNode(rawNode, node);
            
            const children = (Object.values(solvedNodes) as DecisionTreeNode[]).filter(n => n.parentId === hoveredNodeId);
            const optimalChild = children.find(c => !c.isPruned);

            return (
              <div
                id="formula-floating-tooltip"
                className="absolute bg-slate-900/95 text-white text-[11px] p-3 rounded-xl border border-indigo-500/30 shadow-2xl pointer-events-none z-40 space-y-2 w-[285px] animate-fade-in transition-all duration-150"
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx - 20}px`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-1.5 font-bold mb-1 border-b border-slate-700 pb-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    node.type === 'DECISION' ? 'bg-orange-500' : node.type === 'CHANCE' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`} />
                  <span className="text-orange-400 font-bold truncate flex-1">{node.name}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-300 font-mono px-1 rounded uppercase">
                    {node.type === 'DECISION' ? '决策' : node.type === 'CHANCE' ? '可能' : '结局'}
                  </span>
                </div>

                {/* High Risk Alert Banner */}
                {isHighRisk && (
                  <div className="bg-red-500/15 border border-red-500/45 p-2 rounded-lg flex items-start gap-1.5 text-red-200">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-[10px] text-red-400 block">⚠️ 临界高风险路径警示</span>
                      <p className="text-[9px] leading-normal text-slate-300">
                        该决策分支的期望收益仅为 <strong className="text-red-400 font-mono">¥{node.emv}w</strong>，低于安全警戒线 ({rawNode.enableRiskWarning ? (rawNode.riskThreshold ?? 0) : 5}w)。回报率过低或有亏损风险。
                      </p>
                    </div>
                  </div>
                )}

                {/* Optimal Decision Highlight Section */}
                {node.type === 'DECISION' && optimalChild && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg space-y-1.5">
                    <span className="text-[10px] text-emerald-400 font-extrabold tracking-wider uppercase block flex items-center gap-1">
                      👑 推荐最优决策方案:
                    </span>
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-300">
                      <span className="truncate">👉 【{optimalChild.name}】</span>
                      <span className="font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[11px]">
                        折现: ¥ {((optimalChild.emv ?? 0) - (optimalChild.cost ?? 0)).toFixed(1)}万
                      </span>
                    </div>
                    {optimalChild.cost && optimalChild.cost > 0 ? (
                      <div className="text-[9.5px] text-slate-400 flex justify-between">
                        <span>前期投入成本:</span>
                        <span>¥ {optimalChild.cost}万</span>
                      </div>
                    ) : null}
                    
                    {/* Downstream chance/terminal distribution of this choice */}
                    {(() => {
                      const grandchildren = (Object.values(solvedNodes) as DecisionTreeNode[]).filter(n => n.parentId === optimalChild.id);
                      if (grandchildren.length > 0) {
                        return (
                          <div className="mt-2 pt-1.5 border-t border-emerald-500/20 space-y-1">
                            <span className="text-[9px] text-emerald-400/80 font-bold block">📊 后续概率分布与损益预测:</span>
                            <div className="space-y-0.5 max-h-24 overflow-y-auto">
                              {grandchildren.map((gc) => {
                                const isGcPruned = gc.isPruned;
                                return (
                                  <div key={`gc-${gc.id}`} className={`flex justify-between items-center text-[10px] ${isGcPruned ? 'line-through text-slate-500 opacity-55' : 'text-slate-300 font-medium'}`}>
                                    <span className="truncate">
                                      - {gc.name}
                                      {gc.probability !== undefined && ` (${Math.round(gc.probability * 100)}%)`}
                                    </span>
                                    <span className="font-mono text-[9.5px]">
                                      ¥ {gc.emv !== undefined ? gc.emv.toFixed(1) : (gc.payoff ?? 0).toFixed(1)}万
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Calculation breakdown formulas */}
                <div className="space-y-1">
                  <span className="text-[9.5px] text-indigo-300 font-extrabold tracking-wider uppercase block">📐 运算回溯分析：</span>
                  <pre className="font-mono text-[9.5px] whitespace-pre-wrap leading-relaxed bg-slate-950/50 p-2 rounded border border-slate-800 text-slate-300">
                    {getFormulaText(hoveredNodeId)}
                  </pre>
                </div>
              </div>
            );
          })()
        )}

        {/* 4. DOCK SLIDING PANEL INSIDE THE CANVAS CARD */}
        {editingLinkId && editingNode && (
          <div 
            id="path-direct-settings-panel"
            className="absolute top-0 right-0 bottom-0 w-[310px] bg-white border-l border-slate-200 z-30 shadow-2xl flex flex-col animate-fade-in transition-all duration-300"
          >
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-250 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-xs text-slate-800">路径分支高级配置</span>
              </div>
              <button
                type="button"
                onClick={() => onSelectNode(null)}
                className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                title="关闭设置"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Context Breadcrumb */}
              {parentNode && (
                <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg space-y-1 text-[11px]">
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">父节点 context</div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <span className={`w-2 h-2 rounded-full ${parentNode.type === 'CHANCE' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                    <span>{parentNode.name} ({parentNode.type === 'CHANCE' ? '可能状态' : '选择路线'})</span>
                  </div>
                </div>
              )}

              {/* Input for Branch Name */}
              <div className="space-y-1 relative">
                <label className="text-[11px] font-bold text-slate-500 block">分支或标签名称：</label>
                <input
                  type="text"
                  value={editingNode.name}
                  onChange={(e) => onUpdateNode && onUpdateNode(editingNode.id, { name: e.target.value })}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 200)}
                  className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  placeholder="如: 高需求, 众筹追加"
                />

                {/* Autocomplete suggestions dropdown list */}
                {inputFocused && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto py-1">
                    <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 border-b border-slate-100 bg-slate-50 uppercase tracking-wider">
                      历史与常用分支推荐
                    </div>
                    {filteredSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={() => {
                          if (onUpdateNode) {
                            onUpdateNode(editingNode.id, { name: s });
                          }
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-indigo-50/50 text-[11px] font-medium text-slate-700 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span>{s}</span>
                        {treeBranchNames.includes(s) && (
                          <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 rounded font-bold">已用</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick select capsule tags */}
                {filteredSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {filteredSuggestions.slice(0, 3).map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onUpdateNode && onUpdateNode(editingNode.id, { name: s })}
                        className="bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-0.5 rounded text-[10px] text-slate-600 transition-colors cursor-pointer border border-slate-200 font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Conditional block for CHANCE node (Probability settings) */}
              {parentNode?.type === 'CHANCE' && (
                <div className="space-y-3.5 border-t border-slate-100 pt-3.5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-500 block">发生概率 (Probability)：</label>
                      <span className="font-mono bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10.5px]">
                        {Math.round((editingNode.probability || 0) * 100)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round((editingNode.probability || 0) * 100)}
                        onChange={(e) => {
                          if (onUpdateNode) {
                            const val = parseFloat(e.target.value) / 100;
                            onUpdateNode(editingNode.id, { probability: val });
                          }
                        }}
                        className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={Math.round((editingNode.probability || 0) * 100)}
                        onChange={(e) => {
                          if (onUpdateNode) {
                            const parsed = parseFloat(e.target.value);
                            const val = isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed)) / 100;
                            onUpdateNode(editingNode.id, { probability: val });
                          }
                        }}
                        className="w-14 px-1.5 py-1 text-center border border-slate-200 rounded font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Sibling probabilities tracker & Balancing Tools */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-2 text-[11px]">
                    <div className="flex justify-between items-center text-slate-400 font-semibold text-[9.5px] uppercase tracking-wider">
                      <span>分支概率合算状况</span>
                      <span className={`font-mono font-bold px-1 rounded ${totalProbPercent === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'}`}>
                        {totalProbPercent}% / 100%
                      </span>
                    </div>

                    {/* Miniature listing of siblings */}
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {siblingsAll.map(sib => (
                        <div key={`sib-${sib.id}`} className="flex justify-between items-center text-slate-600 font-medium">
                          <span className={`truncate max-w-[140px] ${sib.id === editingNode.id ? 'text-indigo-600 font-bold' : ''}`}>
                            {sib.name} {sib.id === editingNode.id ? '(当前)' : ''}
                          </span>
                          <span className="font-mono">{Math.round((sib.probability || 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Warning if not 100% */}
                    {totalProbPercent !== 100 && (
                      <div className="text-[10px] text-red-600 leading-normal font-medium bg-red-50/55 p-1.5 rounded flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0 text-red-500 mt-0.5" />
                        <span>同域分支总概率和不等于 100%。请进行数学配平以免计算失实。</span>
                      </div>
                    )}

                    {/* Automation balancing tools */}
                    <div className="pt-1.5 border-t border-slate-200/80 space-y-1">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">⚡ 一键无偏平差工具</div>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={handleEqualDistribute}
                          className="py-1 px-1.5 border border-slate-200 bg-white hover:bg-slate-100 rounded text-slate-600 font-medium cursor-pointer text-center flex items-center justify-center gap-1"
                          title="使该同级所有分支平摊概率"
                        >
                          <Scale className="w-3 h-3 text-slate-500" />
                          <span>秤平摊 (均分)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleProRataNormalize}
                          className="py-1 px-1.5 border border-slate-200 bg-white hover:bg-slate-100 rounded text-slate-600 font-medium cursor-pointer text-center flex items-center justify-center gap-1"
                          title="按当前比例无偏拉伸，使得总和重置为 1.0"
                        >
                          <Sliders className="w-2.5 h-2.5 text-slate-500" />
                          <span>等比无偏拉伸</span>
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleFillRemaining}
                        className="w-full py-1 border border-indigo-150 bg-indigo-50/50 hover:bg-indigo-50 rounded text-indigo-700 font-bold text-[10px] cursor-pointer text-center flex items-center justify-center gap-1.5 mt-1"
                        title="将此分支概率自动填满其他分支剩余的差额"
                      >
                        <Check className="w-3 h-3" />
                        <span>本件单独吃满余额 ({Math.max(0, 100 - Math.round(siblings.reduce((a,c)=>a+(c.probability||0), 0)*100))}% )</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Input for Path friction Cost (DECISION branch cost / default node cost) */}
              <div className="space-y-1 border-t border-slate-100 pt-3.5">
                <label className="text-[11px] font-bold text-slate-500 block">投入成本 (Cost) [万元]：</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold text-xs">-¥ </span>
                  <input
                    type="number"
                    min="0"
                    value={editingNode.cost || 0}
                    onChange={(e) => onUpdateNode && onUpdateNode(editingNode.id, { cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="flex-1 px-3 py-1.5 border border-slate-250 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    placeholder="请输入该支出的前期成本费用"
                  />
                  <span className="text-slate-400 font-bold text-[10px]">万元</span>
                </div>
                <span className="text-[9.5px] text-slate-400 leading-normal block">
                  连接该项可能出现的损折或执行成本。该数值将被用于向下级联扣减期望 EMV 实值。
                </span>
              </div>

              {/* Conditional segment for TERMINAL values (so outcome pays can be edited directly on connections too) */}
              {editingNode.type === 'TERMINAL' && (
                <div className="space-y-1 border-t border-slate-100 pt-3.5">
                  <label className="text-[11px] font-bold text-slate-500 block">结局折现净现值 (Terminal Value)：</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-500 font-extrabold text-xs">¥ </span>
                    <input
                      type="number"
                      value={editingNode.payoff || 0}
                      onChange={(e) => onUpdateNode && onUpdateNode(editingNode.id, { payoff: parseFloat(e.target.value) || 0 })}
                      className="flex-1 px-3 py-1.5 border border-emerald-200 focus:border-indigo-500 rounded-lg text-slate-800 bg-emerald-50/20 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                      placeholder="结局结余金额"
                    />
                    <span className="text-slate-400 font-bold text-[10px]">万元</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions of panel */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 mt-auto space-y-2">
              {onDeleteNode && editingNode.id !== 'root' && (
                <div id="branch-del-container" className="pt-1">
                  {deleteConfirmId === editingNode.id ? (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteNode(editingNode.id);
                          setEditingLinkId(null);
                          onSelectNode(null);
                          setDeleteConfirmId(null);
                        }}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all text-center animate-pulse"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>确认彻底剪枝</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-[10.5px] font-semibold transition-all"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(editingNode.id)}
                      className="w-full py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>剪除该路线分支极其子树</span>
                    </button>
                  )}
                </div>
              )}

              {onCloneBranch && editingNode.id !== 'root' && (
                <button
                  type="button"
                  onClick={() => {
                    onCloneBranch(editingNode.id);
                  }}
                  className="w-full py-1.5 border border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="一键复制该路线分支及其全部子决策链，建立平行的 A/B 对比选项"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>路径克隆 (复制分支极其下级子树)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectNode(null)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors text-center block shadow-sm shadow-indigo-100"
              >
                保存并收起面板
              </button>
            </div>

          </div>
        )}
      </div>

      {/* 4. LAYER FOUR: BRANCH EMV COMPARISON FLOATING PANEL */}
      {compareModeActive && (
        <div
          id="branch-compare-floating-panel"
          className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md rounded-xl border border-indigo-200 shadow-xl p-3.5 w-[380px] text-xs space-y-2.5 animate-fade-in text-slate-800"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="font-bold text-indigo-700 flex items-center gap-1.5 text-[12.5px]">
              ⚖️ 分支决策期望双向并排对比 (EMV)
            </span>
            <button
              onClick={() => {
                setCompareModeActive(false);
                setCompareNodeAId(null);
                setCompareNodeBId(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[11px] text-slate-500 leading-normal">
            💡 <span className="font-semibold text-indigo-600">操作指南：</span>请在画布中依次点击任意两个节点（通常为平行的战略路径）将自动高亮显示并计算 EMV 差异，或在下方直接快捷指派。
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Branch A selection slot */}
            <div className={`p-2.5 rounded-lg border transition-all ${compareNodeAId ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-dashed border-slate-200'}`}>
              <div className="flex items-center gap-1 font-bold text-blue-700 text-[10.5px] mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>观察分支 A</span>
              </div>
              {compareNodeAId && tree.nodes[compareNodeAId] ? (
                <div className="space-y-1">
                  <div className="font-bold truncate text-slate-800" title={tree.nodes[compareNodeAId].name}>
                    {tree.nodes[compareNodeAId].name}
                  </div>
                  <div className="font-mono text-[10.5px] text-slate-500 flex justify-between items-center">
                    <span>EMV 期望:</span>
                    <span className="text-blue-600 font-extrabold">¥ {solvedNodes[compareNodeAId]?.emv ?? tree.nodes[compareNodeAId]?.payoff ?? 0}w</span>
                  </div>
                  <button
                    onClick={() => setCompareNodeAId(null)}
                    className="text-[9.5px] text-red-500 hover:underline mt-1 cursor-pointer block"
                  >
                    清除重选
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 py-3 text-center">
                  点击画布中首个节点
                </div>
              )}
            </div>

            {/* Branch B selection slot */}
            <div className={`p-2.5 rounded-lg border transition-all ${compareNodeBId ? 'bg-purple-50/50 border-purple-200' : 'bg-slate-50 border-dashed border-slate-200'}`}>
              <div className="flex items-center gap-1 font-bold text-purple-700 text-[10.5px] mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>观察分支 B</span>
              </div>
              {compareNodeBId && tree.nodes[compareNodeBId] ? (
                <div className="space-y-1">
                  <div className="font-bold truncate text-slate-800" title={tree.nodes[compareNodeBId].name}>
                    {tree.nodes[compareNodeBId].name}
                  </div>
                  <div className="font-mono text-[10.5px] text-slate-500 flex justify-between items-center">
                    <span>EMV 期望:</span>
                    <span className="text-purple-600 font-extrabold">¥ {solvedNodes[compareNodeBId]?.emv ?? tree.nodes[compareNodeBId]?.payoff ?? 0}w</span>
                  </div>
                  <button
                    onClick={() => setCompareNodeBId(null)}
                    className="text-[9.5px] text-red-500 hover:underline mt-1 cursor-pointer block"
                  >
                    清除重选
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 py-3 text-center">
                  点击画布中第二个节点
                </div>
              )}
            </div>
          </div>

          {/* Quick selection dropdown helper */}
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-slate-500 font-medium shrink-0">快捷节点选定:</span>
            <select
              value=""
              onChange={(e) => {
                const parts = e.target.value.split(':');
                if (parts.length < 2) return;
                const target = parts[0];
                const id = parts[1];
                if (!id) return;
                if (target === 'A') setCompareNodeAId(id);
                if (target === 'B') setCompareNodeBId(id);
                // Reset select value
                e.target.value = '';
              }}
              className="flex-1 bg-white border border-slate-200 text-[10.5px] py-1 px-1.5 rounded focus:outline-none font-medium cursor-pointer"
            >
              <option value="">-- 选择节点并快捷指派 --</option>
              {Object.values(tree.nodes)
                .filter((n: any) => n.id !== 'root')
                .map((n: any) => (
                  <optgroup key={`opt-${n.id}`} label={n.name}>
                    <option value={`A:${n.id}`}>指派为 观察分支 A</option>
                    <option value={`B:${n.id}`}>指派为 观察分支 B</option>
                  </optgroup>
                ))}
            </select>
          </div>

          {/* Compare result if both selected */}
          {compareNodeAId && compareNodeBId && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                <span>🏆 决策路径收益优势分析:</span>
              </div>
              <div className="text-[10.5px] text-slate-700 font-medium leading-relaxed">
                {emvDiff === 0 ? (
                  <span>两个分支的决策预期收益完全相等（均值 ¥{emvA} 万），在数学期望上收益一致。</span>
                ) : (
                  <span>
                    路径 <strong className={emvDiff > 0 ? "text-blue-700" : "text-purple-700"}>【{emvDiff > 0 ? tree.nodes[compareNodeAId]?.name : tree.nodes[compareNodeBId]?.name}】</strong> 
                    比路径 <strong>【{emvDiff > 0 ? tree.nodes[compareNodeBId]?.name : tree.nodes[compareNodeAId]?.name}】</strong> 
                    高出期望回报值 <strong className="text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded font-mono font-bold">¥ {Math.abs(emvDiff).toFixed(2)}w</strong>！
                  </span>
                )}
              </div>
              <div className="text-[9.5px] text-emerald-600/90 font-bold border-t border-emerald-100 pt-1 flex items-center justify-between">
                <span>较优路径：高亮为亮绿色霓虹</span>
                <span className="bg-emerald-600 text-white font-bold px-1 rounded-sm uppercase tracking-wider text-[8px]">ACTIVE</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Minimap View Drawer */}
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/50 shadow-sm text-[10px] text-slate-500 font-mono flex items-center gap-2 z-10">
        <span>画布比例: {Math.round(zoom * 100)}%</span>
        <span>最大阶段: {maxDepth + 1} 级</span>
      </div>
    </div>
  );
};
