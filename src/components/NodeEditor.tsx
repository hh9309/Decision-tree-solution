import React from 'react';
import { Trash2, Plus, Sliders, Check, AlertCircle, Info } from 'lucide-react';
import { DecisionTreeNode, NodeType } from '../types';

export const COLOR_THEMES = [
  { id: 'default', label: '默认分类', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600', dot: 'bg-slate-400', activeRing: 'ring-slate-400' },
  { id: 'red', label: '高风险 / 警告', bg: 'bg-red-50 text-red-700', border: 'border-red-200', text: 'text-red-600', dot: 'bg-red-500', activeRing: 'ring-red-500' },
  { id: 'emerald', label: '乐观预测 / 收益', bg: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-500', activeRing: 'ring-emerald-500' },
  { id: 'amber', label: '稳妥中庸 / 保守', bg: 'bg-amber-50 text-amber-700', border: 'border-amber-200', text: 'text-amber-600', dot: 'bg-amber-500', activeRing: 'ring-amber-500' },
];

interface NodeEditorProps {
  selectedNode: DecisionTreeNode | null;
  parentNode: DecisionTreeNode | null;
  onUpdateNode: (id: string, updates: Partial<DecisionTreeNode>) => void;
  onUpdateNodes?: (updates: Record<string, Partial<DecisionTreeNode>>) => void;
  onAddChild: (parentId: string, type: NodeType) => void;
  onDeleteNode: (id: string) => void;
  siblings: DecisionTreeNode[];
}

export const NodeEditor: React.FC<NodeEditorProps> = ({
  selectedNode,
  parentNode,
  onUpdateNode,
  onUpdateNodes,
  onAddChild,
  onDeleteNode,
  siblings
}) => {
  if (!selectedNode) {
    return (
      <div id="node-editor-placeholder" className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center h-[350px]">
        <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-3 animate-pulse">
          <Sliders className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700">节点参数控制中心</h4>
        <p className="text-slate-400 text-xs mt-1.5 max-w-[200px] leading-relaxed">
          点击画布上的任意决策（■）、机会（●）或结局（▲）节点以进行实时参数微调与分支构建。
        </p>
      </div>
    );
  }

  const isRoot = selectedNode.id === 'root';
  const showProbability = parentNode && parentNode.type === 'CHANCE';
  const showPayoff = selectedNode.type === 'TERMINAL';

  // Calculate sum of other sibling probabilities under this parent CHANCE node
  const sumOfOtherProbs = siblings
    .reduce((sum, curr) => sum + (curr.probability || 0), 0);

  const totalProb = sumOfOtherProbs + (selectedNode.probability || 0);
  const totalProbRounded = Math.round(totalProb * 100);
  const probWarning = showProbability && totalProbRounded !== 100;

  // 1. Equal distribution
  const handleEqualDistribute = () => {
    if (!parentNode) return;
    const allNodes = [selectedNode, ...siblings];
    const n = allNodes.length;
    if (n === 0) return;
    const equalVal = Math.round((1.0 / n) * 100) / 100;
    const updates: Record<string, Partial<DecisionTreeNode>> = {};
    allNodes.forEach((node, idx) => {
      const val = idx === n - 1 ? Math.round((1.0 - (equalVal * (n - 1))) * 100) / 100 : equalVal;
      updates[node.id] = { probability: val };
    });
    if (onUpdateNodes) {
      onUpdateNodes(updates);
    } else {
      Object.entries(updates).forEach(([id, u]) => onUpdateNode(id, u));
    }
  };

  // 2. Pro-rata scaling
  const handleProRataNormalize = () => {
    if (!parentNode) return;
    const allNodes = [selectedNode, ...siblings];
    const n = allNodes.length;
    if (n === 0) return;
    const currentTotal = allNodes.reduce((sum, node) => sum + (node.probability || 0), 0);
    if (currentTotal === 0) {
      handleEqualDistribute();
      return;
    }
    const updates: Record<string, Partial<DecisionTreeNode>> = {};
    let distributedSum = 0;
    allNodes.forEach((node, idx) => {
      let val = 0;
      if (idx === n - 1) {
        val = Math.round((1.0 - distributedSum) * 100) / 100;
      } else {
        val = Math.round(((node.probability || 0) / currentTotal) * 100) / 100;
        distributedSum += val;
      }
      updates[node.id] = { probability: val };
    });
    if (onUpdateNodes) {
      onUpdateNodes(updates);
    } else {
      Object.entries(updates).forEach(([id, u]) => onUpdateNode(id, u));
    }
  };

  // 3. Fill remaining balance (set selected node to 1.0 - sumOfOtherProbs)
  const remainingVal = Math.round((1.0 - sumOfOtherProbs) * 100) / 100;
  const handleFillRemaining = () => {
    const val = Math.max(0, Math.min(1.0, remainingVal));
    onUpdateNode(selectedNode.id, { probability: val });
  };

  return (
    <div id="node-editor-panel" className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          {selectedNode.type === 'DECISION' && <div className="w-3.5 h-3.5 bg-orange-500 rounded-sm" />}
          {selectedNode.type === 'CHANCE' && <div className="w-3.5 h-3.5 bg-blue-500 rounded-full" />}
          {selectedNode.type === 'TERMINAL' && <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[12px] border-b-green-500" />}
          
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">参数配置柜</h3>
            <p className="text-slate-400 text-[10px]">实时修改、裁剪与级联运算</p>
          </div>
        </div>
        
        {!isRoot && (
          <button
            id="btn-delete-node"
            onClick={() => onDeleteNode(selectedNode.id)}
            className="p-1 px-2.5 rounded-lg border border-red-50 text-red-500 hover:bg-red-50/50 transition-all text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>删除分支</span>
          </button>
        )}
      </div>

      <div className="space-y-4 text-xs">
        {/* Node Name */}
        <div className="space-y-1.5">
          <label className="text-slate-500 font-semibold block">节点名称 (名称)：</label>
          <input
            id="node-input-name"
            type="text"
            value={selectedNode.name}
            onChange={(e) => onUpdateNode(selectedNode.id, { name: e.target.value })}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-500 bg-slate-50/30"
          />
        </div>

        {/* Color Palette and Classification Labels */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="text-slate-500 font-semibold block flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-3 bg-indigo-500 rounded-xs" />
            <span>决策分支配色与视觉标签：</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {COLOR_THEMES.map((theme) => {
              const isActive = (selectedNode.colorTheme || 'default') === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateNode(selectedNode.id, { colorTheme: theme.id })}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                    isActive
                      ? `${theme.bg} ${theme.border} ring-2 ${theme.activeRing} ring-offset-0.5 font-bold`
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/80 hover:border-slate-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                  <span className="text-[10.5px] truncate">{theme.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Node Type Selector */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100/50 p-1 rounded-xl">
          {(['DECISION', 'CHANCE', 'TERMINAL'] as NodeType[]).map((t) => {
            const isSel = selectedNode.type === t;
            return (
              <button
                id={`node-type-toggle-${t}`}
                key={t}
                onClick={() => onUpdateNode(selectedNode.id, { type: t })}
                className={`py-1.5 text-[10px] rounded-lg font-medium transition-all ${
                  isSel
                    ? 'bg-white text-slate-800 shadow-xs ring-1 ring-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t === 'DECISION' && '■ 决策'}
                {t === 'CHANCE' && '● 机会'}
                {t === 'TERMINAL' && '▲ 结局'}
              </button>
            );
          })}
        </div>

        {/* Branch Probability (Visible only if parent is CHANCE) */}
        {showProbability && (
          <div className="space-y-2 border-t border-slate-50 pt-3">
            <div className="flex justify-between items-center text-slate-500 font-semibold">
              <span className="flex items-center gap-1">分叉概率 P (概率)：</span>
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold text-[11px]">
                {Math.round((selectedNode.probability || 0) * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="node-input-probability-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedNode.probability ?? 0.5}
                onChange={(e) => onUpdateNode(selectedNode.id, { probability: parseFloat(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <input
                id="node-input-probability-number"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={selectedNode.probability ?? 0.5}
                onChange={(e) => {
                  let val = parseFloat(e.target.value);
                  if (isNaN(val)) val = 0;
                  onUpdateNode(selectedNode.id, { probability: Math.max(0, Math.min(1, val)) });
                }}
                className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-mono text-xs bg-slate-50/50"
              />
            </div>

            {/* Probability normalized warnings */}
            {probWarning && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 text-amber-800 text-[11px] space-y-3 mt-3 shadow-xs">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-amber-900 block text-xs">⚠️ 概率和校验异常</span>
                    <span className="leading-relaxed">
                      同属一个机会节点的多个分支概率之和当前为 <strong>{totalProbRounded}%</strong> (未达到或超过 100%)。请执行下方策略进行完备补足或平均分摊。
                    </span>
                  </div>
                </div>

                {/* 当前层级列表展示 */}
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/40 space-y-1.5 font-sans text-[10.5px] text-slate-700">
                  <div className="font-semibold text-slate-500 flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                    <span>同组分叉成员概率清单：</span>
                    <span className="font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9.5px]">当前总计 {totalProbRounded}%</span>
                  </div>
                  <div className="flex justify-between items-center bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                    <span className="truncate max-w-[130px] font-medium text-indigo-900">👉 {selectedNode.name || '当前分支'} (选中)</span>
                    <span className="font-mono font-bold text-indigo-700">{Math.round((selectedNode.probability || 0) * 100)}%</span>
                  </div>
                  {siblings.map(sib => (
                    <div key={`sib-${sib.id}`} className="flex justify-between items-center px-2 py-0.5 text-slate-600">
                      <span className="truncate max-w-[140px]">{sib.name || '其他分支'}</span>
                      <span className="font-mono font-semibold">{Math.round((sib.probability || 0) * 100)}%</span>
                    </div>
                  ))}
                </div>

                {/* 智能建议一键修正动作 */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-amber-800/80 font-semibold uppercase tracking-wider">💡 概率平摊与多选补齐建议:</div>
                  
                  {/* Option 1: Equal division */}
                  <button
                    id="btn-normalize-equal"
                    type="button"
                    onClick={handleEqualDistribute}
                    className="w-full text-left py-2 px-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer group shadow-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-slate-400 group-hover:text-indigo-600 font-semibold">⚖️</span>
                      <span>一键平均分配概率</span>
                    </span>
                    <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                      各 {Math.round((100 / (siblings.length + 1)))}%
                    </span>
                  </button>

                  {/* Option 2: Pro-rata normalization */}
                  {totalProb > 0 && (
                    <button
                      id="btn-normalize-prorata"
                      type="button"
                      onClick={handleProRataNormalize}
                      className="w-full text-left py-2 px-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer group shadow-xs"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400 group-hover:text-indigo-600 font-semibold">📐</span>
                        <span>按比例等比完备化</span>
                      </span>
                      <span className="font-mono text-[10.5px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                        缩放至 100%
                      </span>
                    </button>
                  )}

                  {/* Option 3: Fill remaining balance */}
                  <button
                    id="btn-normalize-fill"
                    type="button"
                    onClick={handleFillRemaining}
                    className="w-full text-left py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100/60 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-emerald-500 font-semibold">🎯</span>
                      <span>当前选中分支补齐余额</span>
                    </span>
                    <span className="font-mono text-[10.5px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                      设为 {Math.round(remainingVal * 100)}%
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transition Cost / Cost (Visible for any sub-branch except root) */}
        {!isRoot && (
          <div className="space-y-1.5 border-t border-slate-50 pt-3">
            <div className="flex justify-between items-center text-slate-500 font-semibold">
              <span>选择/研发追加投入 (支出)：</span>
              <span className="text-slate-700 font-mono text-[11px]">¥{(selectedNode.cost ?? 0)} 万元</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="node-input-cost-slider"
                type="range"
                min="0"
                max="2000"
                step="10"
                value={selectedNode.cost ?? 0}
                onChange={(e) => onUpdateNode(selectedNode.id, { cost: parseInt(e.target.value) })}
                className="w-full accent-slate-700 cursor-pointer"
              />
              <input
                id="node-input-cost-number"
                type="number"
                value={selectedNode.cost ?? 0}
                onChange={(e) => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = 0;
                  onUpdateNode(selectedNode.id, { cost: Math.max(0, val) });
                }}
                className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-mono text-xs bg-slate-50/50"
              />
            </div>
          </div>
        )}

        {/* High-Risk Threshold Alert System (Visible only for DECISION nodes) */}
        {selectedNode.type === 'DECISION' && (
          <div className="space-y-3 border-t border-slate-50 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-slate-500 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>临界风险提醒系统：</span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  id="toggle-risk-warning"
                  type="checkbox"
                  checked={selectedNode.enableRiskWarning ?? false}
                  onChange={(e) => onUpdateNode(selectedNode.id, { enableRiskWarning: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-4"></div>
              </label>
            </div>
            
            {(selectedNode.enableRiskWarning ?? false) && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-2 text-slate-600 animate-fade-in">
                <div className="flex justify-between items-center text-[10.5px] font-semibold text-slate-500">
                  <span>高风险EMV临界值：</span>
                  <span className="text-amber-700 font-mono font-bold">≤ {selectedNode.riskThreshold ?? 0} 万元</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="node-input-risk-threshold-slider"
                    type="range"
                    min="-1000"
                    max="1000"
                    step="20"
                    value={selectedNode.riskThreshold ?? 0}
                    onChange={(e) => onUpdateNode(selectedNode.id, { riskThreshold: parseInt(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <input
                    id="node-input-risk-threshold-number"
                    type="number"
                    value={selectedNode.riskThreshold ?? 0}
                    onChange={(e) => {
                      let val = parseInt(e.target.value);
                      if (isNaN(val)) val = 0;
                      onUpdateNode(selectedNode.id, { riskThreshold: val });
                    }}
                    className="w-16 p-1 border border-slate-200 rounded-lg text-center font-mono text-xs bg-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  当该决策节点的EMV期望值低于设定的临界值时，画布节点上将浮现微型警告雷达，提示用户该路径存在高风险。
                </p>
              </div>
            )}
          </div>
        )}

        {/* Outcome Terminal Payoff (Visible only for TERMINAL nodes) */}
        {showPayoff && (
          <div className="space-y-2 border-t border-slate-50 pt-3">
            <div className="flex justify-between items-center text-slate-500 font-semibold">
              <span>结局终值净损益 (收益)：</span>
              <span className="text-green-600 font-mono font-bold text-[11px]">
                {selectedNode.payoff && selectedNode.payoff >= 0 ? '+' : ''}¥{selectedNode.payoff ?? 0} 万元
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="node-input-payoff-slider"
                type="range"
                min="-3000"
                max="5000"
                step="50"
                value={selectedNode.payoff ?? 0}
                onChange={(e) => onUpdateNode(selectedNode.id, { payoff: parseInt(e.target.value) })}
                className="w-full accent-green-600 cursor-pointer"
              />
              <input
                id="node-input-payoff-number"
                type="number"
                value={selectedNode.payoff ?? 0}
                onChange={(e) => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = 0;
                  onUpdateNode(selectedNode.id, { payoff: val });
                }}
                className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-mono text-xs bg-slate-50/50"
              />
            </div>
          </div>
        )}

        {/* Expected Value display window */}
        {selectedNode.emv !== undefined && (
          <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-3 flex justify-between items-center mt-2.5">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                当前期望货币值 (EMV)
              </span>
              <span className="text-slate-500 text-[10px]">
                {selectedNode.type === 'DECISION' ? '取子分叉最大EMV减去成本' : '加权合计概率值'}
              </span>
            </div>
            <span className="text-emerald-700 font-mono font-extrabold text-sm">
              ¥ {selectedNode.emv} 万元
            </span>
          </div>
        )}

        {/* Add Child Segment */}
        {selectedNode.type !== 'TERMINAL' && (
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <span className="text-slate-500 font-semibold block">➕ 新增子阶段/分叉分支：</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                id="btn-add-decision-child"
                onClick={() => onAddChild(selectedNode.id, 'DECISION')}
                className="py-2.5 rounded-xl border border-slate-150 text-slate-600 bg-white/50 hover:bg-orange-50/30 hover:border-orange-200 hover:text-orange-600 transition-all text-[10px] font-medium flex flex-col items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ 决策分叉</span>
              </button>
              
              <button
                id="btn-add-chance-child"
                onClick={() => onAddChild(selectedNode.id, 'CHANCE')}
                className="py-2.5 rounded-xl border border-slate-150 text-slate-600 bg-white/50 hover:bg-blue-50/30 hover:border-blue-200 hover:text-blue-600 transition-all text-[10px] font-medium flex flex-col items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ 机会状态</span>
              </button>

              <button
                id="btn-add-terminal-child"
                onClick={() => onAddChild(selectedNode.id, 'TERMINAL')}
                className="py-2.5 rounded-xl border border-slate-150 text-slate-600 bg-white/50 hover:bg-green-50/30 hover:border-green-200 hover:text-green-600 transition-all text-[10px] font-medium flex flex-col items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ 终点结局</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
