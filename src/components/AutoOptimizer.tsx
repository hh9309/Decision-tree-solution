import React, { useState, useMemo } from 'react';
import { Sliders, Sparkles, TrendingUp, AlertCircle, Check, Settings, ShieldAlert, Cpu } from 'lucide-react';
import { DecisionTree, DecisionTreeNode, Scenario } from '../types';
import { runBackwardInduction } from '../treeEngine';

interface AutoOptimizerProps {
  currentScenario: Scenario;
  onUpdateScenarioTree: (updatedTree: DecisionTree) => void;
  onCloneNewScenario: (name: string, tree: DecisionTree) => void;
}

export const AutoOptimizer: React.FC<AutoOptimizerProps> = ({
  currentScenario,
  onUpdateScenarioTree,
  onCloneNewScenario
}) => {
  const currentRootEmv = useMemo(() => {
    const solved = runBackwardInduction(currentScenario.tree);
    return solved[currentScenario.tree.rootId]?.emv ?? 0;
  }, [currentScenario.tree]);

  // Track target EMV entered by user. Default to current EMV + 20w (or some premium)
  const defaultTarget = Math.round(currentRootEmv * 1.25 + 10);
  const [targetEmv, setTargetEmv] = useState<number>(defaultTarget);

  // Identify sweepable / adjustable parameter entities
  const adjustableNodes = useMemo(() => {
    const costNodes: DecisionTreeNode[] = [];
    const probNodes: DecisionTreeNode[] = [];
    const parentMap: Record<string, DecisionTreeNode> = {};

    (Object.values(currentScenario.tree.nodes) as DecisionTreeNode[]).forEach(n => {
      // Collect nodes with costs
      if (n.cost !== undefined && n.cost > 0) {
        costNodes.push(n);
      }
      // Collect chance nodes
      if (n.parentId) {
        const parent = currentScenario.tree.nodes[n.parentId];
        if (parent && parent.type === 'CHANCE' && n.probability !== undefined) {
          probNodes.push(n);
          parentMap[n.id] = parent;
        }
      }
    });

    return { costNodes, probNodes, parentMap };
  }, [currentScenario.tree]);

  // Solver calculations for three distinct optimization schemes
  const optimizationResults = useMemo(() => {
    const { costNodes, probNodes, parentMap } = adjustableNodes;
    const tree = currentScenario.tree;

    // -------------------------------------------------------------
    // SCHEME A: 成本优化控制 (Proportionate Cost Reduction)
    // -------------------------------------------------------------
    let schemeAApplied = false;
    let schemeAClosestEmv = currentRootEmv;
    let schemeACostFactor = 1.0; // multiplier (e.g. 0.8 means 20% cost reduction)
    let adjustedCostsList: { nodeName: string; originalVal: number; targetVal: number }[] = [];

    if (costNodes.length > 0) {
      // Find the best costFactor (from 1.0 down to 0.0 with 100 steps)
      for (let step = 0; step <= 100; step++) {
        const factor = Math.round((1.0 - step * 0.01) * 100) / 100;
        
        // Clone tree
        const clonedTree = JSON.parse(JSON.stringify(tree)) as DecisionTree;
        costNodes.forEach(n => {
          if (clonedTree.nodes[n.id]) {
            clonedTree.nodes[n.id].cost = Math.round((n.cost || 0) * factor * 10) / 10;
          }
        });

        const solved = runBackwardInduction(clonedTree);
        const newRootEmv = solved[tree.rootId]?.emv ?? 0;
        
        if (newRootEmv >= targetEmv) {
          schemeAApplied = true;
          schemeAClosestEmv = newRootEmv;
          schemeACostFactor = factor;
          break;
        }
        if (factor === 0.0) {
          schemeAClosestEmv = newRootEmv; // best we can do with zero absolute costs
          schemeACostFactor = 0.0;
        }
      }

      adjustedCostsList = costNodes.map(n => ({
        nodeName: n.name,
        originalVal: n.cost || 0,
        targetVal: Math.round((n.cost || 0) * schemeACostFactor * 10) / 10
      }));
    }

    // -------------------------------------------------------------
    // SCHEME B: 概率增益提升 (Targeted Probability Booster)
    // -------------------------------------------------------------
    // We pick the chance branch whose adjustment has the most impact on root EMV
    let schemeBApplied = false;
    let schemeBBestTargetNodeId = '';
    let schemeBBestTargetNodeName = '';
    let schemeBOriginalProbability = 0;
    let schemeBTargetProbability = 0;
    let schemeBClosestEmv = currentRootEmv;
    let adjustedProbabilitiesList: { nodeName: string; parentNodeName: string; originalVal: string; targetVal: string }[] = [];

    if (probNodes.length > 0) {
      // Let's analyze each probability node to see which one can help hit the target EMV
      let bestChoiceNodeId = '';
      let requiredProb = 1.0;
      let closestEmvForBest = currentRootEmv;

      probNodes.forEach(pn => {
        // We sweep its probability from original state up to 1.0
        const pCurrent = pn.probability ?? 0;
        if (pCurrent >= 0.95) return; // already fully optimal, skip

        for (let testP = Math.round(pCurrent * 100); testP <= 100; testP++) {
          const targetP = testP / 100.0;
          
          // Test in cloned tree
          const clonedTree = JSON.parse(JSON.stringify(tree)) as DecisionTree;
          const nodeToSet = clonedTree.nodes[pn.id];
          if (nodeToSet && nodeToSet.parentId) {
            nodeToSet.probability = targetP;

            // Balance other siblings
            const parentId = nodeToSet.parentId;
            const siblings = Object.values(clonedTree.nodes).filter(
              (n: any) => n.parentId === parentId && n.id !== pn.id
            ) as DecisionTreeNode[];

            const remaining = 1.0 - targetP;
            const currentSibSum = siblings.reduce((acc, curr) => acc + (curr.probability || 0), 0);
            if (siblings.length > 0) {
              if (currentSibSum > 0) {
                const scale = remaining / currentSibSum;
                siblings.forEach(sib => {
                  clonedTree.nodes[sib.id].probability = Math.max(0, Math.round((sib.probability || 0) * scale * 100) / 100);
                });
              } else {
                siblings.forEach(sib => {
                  clonedTree.nodes[sib.id].probability = Math.max(0, Math.round((remaining / siblings.length) * 100) / 100);
                });
              }
            }
          }

          const solved = runBackwardInduction(clonedTree);
          const newEmv = solved[tree.rootId]?.emv ?? 0;

          if (newEmv >= targetEmv) {
            // Found a solution! Choose the node that requires the smallest absolute jump,
            // or just prioritize the first one that works.
            if (!bestChoiceNodeId || targetP - pCurrent < requiredProb - (tree.nodes[bestChoiceNodeId]?.probability ?? 0)) {
              bestChoiceNodeId = pn.id;
              requiredProb = targetP;
              closestEmvForBest = newEmv;
              schemeBApplied = true;
            }
            break;
          }

          if (testP === 100 && newEmv > closestEmvForBest) {
            // If it doesn't reach the target, but is better than our previous best effort
            if (!bestChoiceNodeId) {
              bestChoiceNodeId = pn.id;
              requiredProb = 1.0;
              closestEmvForBest = newEmv;
            }
          }
        }
      });

      if (bestChoiceNodeId) {
        schemeBBestTargetNodeId = bestChoiceNodeId;
        const targetNode = tree.nodes[bestChoiceNodeId];
        schemeBBestTargetNodeName = targetNode.name;
        schemeBOriginalProbability = targetNode.probability ?? 0;
        schemeBTargetProbability = requiredProb;
        schemeBClosestEmv = closestEmvForBest;

        const parentNode = parentMap[bestChoiceNodeId];

        adjustedProbabilitiesList = [{
          nodeName: targetNode.name,
          parentNodeName: parentNode ? parentNode.name : '机会事件',
          originalVal: `${Math.round(schemeBOriginalProbability * 100)}%`,
          targetVal: `${Math.round(schemeBTargetProbability * 100)}%`
        }];
      }
    }

    // -------------------------------------------------------------
    // SCHEME C: 成本和概率协同调优 (Joint Cost-Probability Balance)
    // -------------------------------------------------------------
    // Combined action: Reduce cost by 20% flat, then solve for probability of the best chance node.
    let schemeCApplied = false;
    let schemeCClosestEmv = currentRootEmv;
    let schemeCBestTargetNodeId = schemeBBestTargetNodeId || (probNodes[0]?.id ?? '');
    let schemeCTargetProbability = 0;
    const jointAdjustments: { type: 'COST' | 'PROBABILITY'; name: string; originalVal: string; targetVal: string }[] = [];

    if (costNodes.length > 0 || probNodes.length > 0) {
      const clonedTree = JSON.parse(JSON.stringify(tree)) as DecisionTree;
      
      // 1. Moderate cost reduction (say 20% off all route costs)
      costNodes.forEach(n => {
        if (clonedTree.nodes[n.id]) {
          const original = n.cost || 0;
          const target = Math.round(original * 0.8 * 10) / 10;
          clonedTree.nodes[n.id].cost = target;
          jointAdjustments.push({
            type: 'COST',
            name: `[成本] ${n.name}`,
            originalVal: `¥${original}万`,
            targetVal: `¥${target}万`
          });
        }
      });

      // 2. Solve for probability of the main success node after cost reduction
      if (schemeCBestTargetNodeId && clonedTree.nodes[schemeCBestTargetNodeId]) {
        const origP = tree.nodes[schemeCBestTargetNodeId].probability ?? 0;
        let finalP = origP;

        for (let testP = Math.round(origP * 100); testP <= 100; testP++) {
          const targetP = testP / 100.0;
          const localCloned = JSON.parse(JSON.stringify(clonedTree)) as DecisionTree;
          
          const nodeToSet = localCloned.nodes[schemeCBestTargetNodeId];
          if (nodeToSet && nodeToSet.parentId) {
            nodeToSet.probability = targetP;

            // Balance siblings of local clone
            const siblings = Object.values(localCloned.nodes).filter(
              (n: any) => n.parentId === nodeToSet.parentId && n.id !== schemeCBestTargetNodeId
            ) as DecisionTreeNode[];
            const remaining = 1.0 - targetP;
            const currentSibSum = siblings.reduce((acc, curr) => acc + (curr.probability || 0), 0);

            if (siblings.length > 0) {
              if (currentSibSum > 0) {
                const scale = remaining / currentSibSum;
                siblings.forEach(sib => {
                  localCloned.nodes[sib.id].probability = Math.max(0, Math.round((sib.probability || 0) * scale * 100) / 100);
                });
              } else {
                siblings.forEach(sib => {
                  localCloned.nodes[sib.id].probability = Math.max(0, Math.round((remaining / siblings.length) * 100) / 100);
                });
              }
            }
          }

          const solved = runBackwardInduction(localCloned);
          const solvedEmv = solved[tree.rootId]?.emv ?? 0;

          if (solvedEmv >= targetEmv) {
            schemeCApplied = true;
            schemeCClosestEmv = solvedEmv;
            finalP = targetP;
            break;
          }
          if (testP === 100) {
            schemeCClosestEmv = solvedEmv;
            finalP = 1.0;
          }
        }

        schemeCTargetProbability = finalP;
        jointAdjustments.push({
          type: 'PROBABILITY',
          name: `[概率] ${clonedTree.nodes[schemeCBestTargetNodeId].name}`,
          originalVal: `${Math.round(origP * 100)}%`,
          targetVal: `${Math.round(finalP * 100)}%`
        });
      }
    }

    return {
      schemeA: {
        applied: schemeAApplied,
        closestEmv: schemeAClosestEmv,
        costFactor: schemeACostFactor,
        adjustments: adjustedCostsList
      },
      schemeB: {
        applied: schemeBApplied,
        nodeId: schemeBBestTargetNodeId,
        nodeName: schemeBBestTargetNodeName,
        targetProb: schemeBTargetProbability,
        closestEmv: schemeBClosestEmv,
        adjustments: adjustedProbabilitiesList
      },
      schemeC: {
        applied: schemeCApplied,
        closestEmv: schemeCClosestEmv,
        adjustments: jointAdjustments,
        targetProb: schemeCTargetProbability
      }
    };
  }, [adjustableNodes, targetEmv, currentScenario.tree, currentRootEmv]);

  // Handle applying a selected optimization scheme to the active scenario or cloning a new one
  const handleApplyScheme = (schemeType: 'A' | 'B' | 'C', createAsNew: boolean) => {
    const tree = currentScenario.tree;
    const clonedTree = JSON.parse(JSON.stringify(tree)) as DecisionTree;
    const { costNodes, probNodes } = adjustableNodes;

    if (schemeType === 'A') {
      const { costFactor } = optimizationResults.schemeA;
      costNodes.forEach(n => {
        if (clonedTree.nodes[n.id]) {
          clonedTree.nodes[n.id].cost = Math.round((n.cost || 0) * costFactor * 10) / 10;
        }
      });
    } else if (schemeType === 'B') {
      const { nodeId, targetProb } = optimizationResults.schemeB;
      const targetNode = clonedTree.nodes[nodeId];
      if (targetNode && targetNode.parentId) {
        targetNode.probability = targetProb;

        // Balance siblings
        const siblings = Object.values(clonedTree.nodes).filter(
          (n: any) => n.parentId === targetNode.parentId && n.id !== nodeId
        ) as DecisionTreeNode[];
        const remaining = 1.0 - targetProb;
        const currentSibSum = siblings.reduce((acc, curr) => acc + (curr.probability || 0), 0);

        if (siblings.length > 0) {
          if (currentSibSum > 0) {
            const scale = remaining / currentSibSum;
            siblings.forEach(sib => {
              clonedTree.nodes[sib.id].probability = Math.max(0, Math.round((sib.probability || 0) * scale * 100) / 100);
            });
          } else {
            siblings.forEach(sib => {
              clonedTree.nodes[sib.id].probability = Math.max(0, Math.round((remaining / siblings.length) * 100) / 100);
            });
          }
        }
      }
    } else {
      // Scheme C: Joint
      // 1. Cost 20% off
      costNodes.forEach(n => {
        if (clonedTree.nodes[n.id]) {
          clonedTree.nodes[n.id].cost = Math.round((n.cost || 0) * 0.8 * 10) / 10;
        }
      });
      // 2. Probability boost
      const { nodeId } = optimizationResults.schemeB; // use same sensitive node
      const targetProb = optimizationResults.schemeC.targetProb;
      const targetNode = clonedTree.nodes[nodeId || probNodes[0]?.id];
      if (targetNode && targetNode.parentId) {
        targetNode.probability = targetProb;

        // Balance siblings
        const siblings = Object.values(clonedTree.nodes).filter(
          (n: any) => n.parentId === targetNode.parentId && n.id !== targetNode.id
        ) as DecisionTreeNode[];
        const remaining = 1.0 - targetProb;
        const currentSibSum = siblings.reduce((acc, curr) => acc + (curr.probability || 0), 0);

        if (siblings.length > 0) {
          if (currentSibSum > 0) {
            const scale = remaining / currentSibSum;
            siblings.forEach(sib => {
              clonedTree.nodes[sib.id].probability = Math.max(0, Math.round((sib.probability || 0) * scale * 100) / 100);
            });
          } else {
            siblings.forEach(sib => {
              clonedTree.nodes[sib.id].probability = Math.max(0, Math.round((remaining / siblings.length) * 100) / 100);
            });
          }
        }
      }
    }

    if (createAsNew) {
      let suffix = '';
      if (schemeType === 'A') suffix = '精益降本优化版';
      else if (schemeType === 'B') suffix = '概率增效保障版';
      else suffix = '降本提效协同版';
      
      onCloneNewScenario(`${currentScenario.name}-${suffix}`, clonedTree);
    } else {
      onUpdateScenarioTree(clonedTree);
    }
  };

  return (
    <div id="auto-optimizer-section" className="bg-white rounded-xl border border-slate-200 p-5 mt-6 space-y-5 shadow-sm">
      
      {/* Target EMV Optimizer Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
            <Cpu className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">EMV 智能逆向参数优化计算器 (Target Solver)</h3>
            <p className="text-slate-400 text-[10px]">根据目标收益，智能算法一键逆推路线成本极限或概率触发保底</p>
          </div>
        </div>
      </div>

      {/* Target Input Section */}
      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-150 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-4 space-y-1">
          <label className="text-xs font-bold text-slate-700 block">🎯 输入您的期望目标 EMV 均值</label>
          <span className="text-[10px] text-slate-400 block">目前根节点预期均值为: <strong className="text-indigo-600 font-bold">¥{currentRootEmv}万</strong></span>
        </div>

        {/* Input slider and numeric field */}
        <div className="md:col-span-5 flex items-center gap-3">
          <input
            type="range"
            min={Math.round(currentRootEmv * 0.5)}
            max={Math.round(currentRootEmv * 2.2)}
            value={targetEmv}
            onChange={(e) => setTargetEmv(Number(e.target.value))}
            className="flex-1 accent-indigo-600 h-1 rounded-lg bg-slate-200 cursor-pointer"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={targetEmv}
              onChange={(e) => setTargetEmv(Math.max(0, Number(e.target.value)))}
              className="w-16 p-1 text-center font-mono font-bold text-xs border border-slate-200 rounded-md bg-white text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-500 font-bold">万</span>
          </div>
        </div>

        <div className="md:col-span-3 text-right">
          <span id="target-solver-match-rate" className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold px-2.5 py-1 rounded-lg block text-center md:inline-block">
            目标增幅: +{Math.max(0, Math.round(((targetEmv - currentRootEmv) / Math.max(1, currentRootEmv)) * 100))}%
          </span>
        </div>
      </div>

      {/* Advice Path Proposals Display Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed">
        
        {/* SCHEME A CARD: Cost Minimizer */}
        <div className="border border-slate-200/80 rounded-xl p-4 bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between space-y-3.5 relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">方案一 · 精益降本</span>
              {optimizationResults.schemeA.applied ? (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">✓ 完美实现</span>
              ) : (
                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5" title="降本至 0 仍不足以提供该 EMV">⚠ 极限贴近</span>
              )}
            </div>

            <h4 className="font-bold text-slate-800 text-xs">投入成本均衡缩减路线</h4>
            <p className="text-[10px] text-slate-400">通过压缩备选分摊的软硬件投入与路线预算预算开支，缩紧项目安全冗余度达成目标收益。</p>

            <div className="bg-slate-50/70 rounded-lg p-2.5 space-y-1.5 border border-slate-100 font-mono text-[10px]">
              <span className="text-slate-400 block border-b border-slate-150 pb-1 mb-1 font-sans text-[9px] font-bold uppercase">调整建议参数对折：</span>
              {optimizationResults.schemeA.adjustments.length > 0 ? (
                optimizationResults.schemeA.adjustments.map((adj, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 truncate max-w-[100px]" title={adj.nodeName}>{adj.nodeName}成本</span>
                    <span className="text-right whitespace-nowrap">
                      <span className="text-slate-450 line-through text-[9px]">¥{adj.originalVal}w</span>
                      <span className="text-slate-300 mx-1">➔</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded">¥{adj.targetVal}w</span>
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-center py-2 font-sans text-[9.5px]">当前模型内没有可供调降成本的节点 (成本皆等于0)</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10.5px] text-slate-500 font-sans flex items-baseline justify-between">
              <span>达成后 EMV 预测:</span>
              <strong className="text-slate-700 font-bold text-xs">¥{optimizationResults.schemeA.closestEmv}万</strong>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleApplyScheme('A', false)}
                disabled={optimizationResults.schemeA.adjustments.length === 0}
                className="py-1 px-2 border border-slate-200 hover:border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center transition-all"
              >
                覆盖当前
              </button>
              <button
                onClick={() => handleApplyScheme('A', true)}
                disabled={optimizationResults.schemeA.adjustments.length === 0}
                className="py-1 px-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-[10px] font-bold text-white shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center transition-all"
              >
                派生新方案
              </button>
            </div>
          </div>
        </div>

        {/* SCHEME B CARD: Probability Booster */}
        <div className="border border-slate-200/80 rounded-xl p-4 bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between space-y-3.5 relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">方案二 · 概率达成保底</span>
              {optimizationResults.schemeB.applied ? (
                <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-0.5">✓ 完美实现</span>
              ) : (
                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5" title="即使概率提至最大100%仍达不到目标值">⚠ 极限提升</span>
              )}
            </div>

            <h4 className="font-bold text-slate-800 text-xs">关键事件概率支撑保底</h4>
            <p className="text-[10px] text-slate-400">针对最敏感的不确定性分支进行对偶求解。计算能够保障最终获胜预期的概率红线底阀。</p>

            <div className="bg-slate-50/70 rounded-lg p-2.5 space-y-1.5 border border-slate-100 font-mono text-[10px]">
              <span className="text-slate-400 block border-b border-slate-150 pb-1 mb-1 font-sans text-[9px] font-bold uppercase">调整建议参数对折：</span>
              {optimizationResults.schemeB.adjustments.length > 0 ? (
                optimizationResults.schemeB.adjustments.map((adj, idx) => (
                  <div key={idx} className="flex flex-col space-y-0.5">
                    <span className="text-[9px] text-slate-400 font-sans font-semibold">[{adj.parentNodeName}] ➔</span>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 truncate max-w-[120px]" title={adj.nodeName}>{adj.nodeName} 概率</span>
                      <span className="text-right whitespace-nowrap">
                        <span className="text-slate-400 text-[9px]">{adj.originalVal}</span>
                        <span className="text-slate-300 mx-1">➔</span>
                        <span className="text-indigo-700 font-bold bg-indigo-50 px-1 py-0.2 rounded">{adj.targetVal}</span>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-center py-2 font-sans text-[9.5px]">当前模型没有符合调整的机会节点</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10.5px] text-slate-500 font-sans flex items-baseline justify-between">
              <span>达成后 EMV 预测:</span>
              <strong className="text-slate-700 font-bold text-xs">¥{optimizationResults.schemeB.closestEmv}万</strong>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleApplyScheme('B', false)}
                disabled={!optimizationResults.schemeB.nodeId}
                className="py-1 px-2 border border-slate-200 hover:border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center transition-all"
              >
                覆盖当前
              </button>
              <button
                onClick={() => handleApplyScheme('B', true)}
                disabled={!optimizationResults.schemeB.nodeId}
                className="py-1 px-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-[10px] font-bold text-white shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center transition-all"
              >
                派生新方案
              </button>
            </div>
          </div>
        </div>

        {/* SCHEME C CARD: Joint Solver */}
        <div className="border border-slate-200/80 rounded-xl p-4 bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between space-y-3.5 relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wider">方案三 · 协同减负提质</span>
              {optimizationResults.schemeC.applied ? (
                <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">✓ 完美实现</span>
              ) : (
                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">⚠ 极限最优</span>
              )}
            </div>

            <h4 className="font-bold text-slate-800 text-xs">成本与成功率交叉协同解</h4>
            <p className="text-[10px] text-slate-400">极力推荐。通过 20% 成本轻量削减 + 成功率稳态微幅增资，低难度联动配合击打目标 EMV。</p>

            <div className="bg-slate-50/70 rounded-lg p-2 py-1.5 space-y-1 block border border-slate-100 font-mono text-[9px] max-h-[85px] overflow-y-auto scrollbar-thin">
              <span className="text-slate-400 block border-b border-slate-150 pb-0.5 mb-1 font-sans text-[8.5px] font-bold uppercase">调整建议联合变量：</span>
              {optimizationResults.schemeC.adjustments.map((adj, idx) => (
                <div key={idx} className="flex justify-between items-center leading-none py-0.5">
                  <span className="text-slate-500 truncate max-w-[120px]">{adj.name}</span>
                  <span className="text-right">
                    <span className="text-slate-405 text-[8px]">{adj.originalVal}</span>
                    <span className="text-slate-300 mx-0.5">➔</span>
                    <span className="text-amber-800 font-bold bg-amber-50 px-1 py-0.1 rounded">{adj.targetVal}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10.5px] text-slate-500 font-sans flex items-baseline justify-between">
              <span>达成后 EMV 预测:</span>
              <strong className="text-slate-705 font-bold text-xs">¥{optimizationResults.schemeC.closestEmv}万</strong>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleApplyScheme('C', false)}
                disabled={optimizationResults.schemeC.adjustments.length === 0}
                className="py-1 px-2 border border-slate-200 hover:border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center transition-all"
              >
                覆盖当前
              </button>
              <button
                onClick={() => handleApplyScheme('C', true)}
                disabled={optimizationResults.schemeC.adjustments.length === 0}
                className="py-1 px-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-[10px] font-bold text-white shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center transition-all"
              >
                派生新方案
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
