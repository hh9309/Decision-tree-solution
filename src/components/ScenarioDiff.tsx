import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  TrendingUp, 
  HelpCircle, 
  Sparkles, 
  Sliders, 
  Info, 
  Compass, 
  Activity, 
  Layers, 
  ChevronRight, 
  AlertCircle 
} from 'lucide-react';
import { DecisionTree, DecisionTreeNode, Scenario } from '../types';
import { runBackwardInduction } from '../treeEngine';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar 
} from 'recharts';

interface ScenarioDiffProps {
  currentScenario: Scenario;
  scenariosList: Scenario[];
  onLoadScenario: (scenario: Scenario) => void;
  onCloneScenario: (name: string) => void;
}

// Simulated active particle representation for Monte Carlo flow
interface SimParticle {
  id: number;
  path: string[];
  step: number;
  progress: number;
  color: string;
}

export const ScenarioDiff: React.FC<ScenarioDiffProps> = ({
  currentScenario,
  scenariosList,
  onLoadScenario,
  onCloneScenario
}) => {
  const tree = currentScenario.tree;
  const solvedNodes = useMemo(() => runBackwardInduction(tree), [tree]);

  // View state: 'radar' or 'line' for sensitivity analysis
  const [sensitivityMode, setSensitivityMode] = useState<'radar' | 'line'>('radar');

  // ===================================
  // 1. LEFT SCREEN: MULTIDIMENSIONAL SENSITIVITY (RADAR & LINE)
  // ===================================

  // Retrieve top level option branches (immediate children of root node)
  const topBranches = useMemo(() => {
    return (Object.values(tree.nodes) as DecisionTreeNode[])
      .filter(n => n.parentId === tree.rootId);
  }, [tree]);

  // Recursive helper to check if a node is a descendant of an option
  const isDescendant = (nodeId: string, ancestorId: string): boolean => {
    let current = tree.nodes[nodeId];
    while (current && current.parentId) {
      if (current.parentId === ancestorId) return true;
      current = tree.nodes[current.parentId];
    }
    return false;
  };

  // Joint probability of visiting a terminal node
  const getJointProbability = (nodeId: string): number => {
    let current = tree.nodes[nodeId];
    let prob = 1;
    while (current) {
      if (current.parentId) {
        const parent = tree.nodes[current.parentId];
        if (parent && parent.type === 'CHANCE') {
          prob *= (current.probability ?? 1);
        }
      }
      current = current.parentId ? tree.nodes[current.parentId] : null as any;
    }
    return prob;
  };

  // Compute Radar Dimensions data for the top branches
  const radarData = useMemo(() => {
    // We want to calculate five standard metrics (0 to 100) for each top branch
    // Metrics:
    // A. Expected Return (期望收益): Scaled relative to the maximum EMV
    // B. Success Likelihood (高回报率): Sum of joint probabilities where payoff is positive
    // C. Cost Efficiency (追加支出控制): 100 - (costs of descendants scaled to 100)
    // D. Risk Resilience (风险防御力): Probability of avoiding negative payoff (100 - loss probability)
    // E. Maximum Potential (收益上限): The maximum terminal payoff relative to the highest payoff in the tree
    
    const allTerminals = (Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.type === 'TERMINAL');
    const globalMaxPayoff = Math.max(...allTerminals.map(n => n.payoff ?? 0), 1);
    const topEmvs = topBranches.map(tb => solvedNodes[tb.id]?.emv ?? tb.payoff ?? 0);
    const maxTopEmv = Math.max(...topEmvs, 1);

    const dims = [
      { name: '期望收益 (EMV)', key: 'emv' },
      { name: '高胜算率 (Prob)', key: 'success' },
      { name: '成本控制 (Cost)', key: 'cost' },
      { name: '风险防御 (Resil)', key: 'risk' },
      { name: '最大天花板 (Cap)', key: 'cap' }
    ];

    return dims.map(dim => {
      const dataPoint: any = { subject: dim.name };
      
      topBranches.forEach(branch => {
        const branchTerminals = allTerminals.filter(t => isDescendant(t.id, branch.id));
        const branchEmv = solvedNodes[branch.id]?.emv ?? branch.payoff ?? 0;
        
        let score = 50; // default baseline

        if (dim.key === 'emv') {
          score = Math.max(10, Math.min(100, (branchEmv / maxTopEmv) * 100));
        } else if (dim.key === 'success') {
          // Sum of joint probabilities of terminal outcomes with payoff > 0
          const posProb = branchTerminals
            .filter(t => (t.payoff ?? 0) > 0)
            .reduce((sum, t) => sum + getJointProbability(t.id), 0);
          score = Math.max(10, Math.min(100, posProb * 100));
        } else if (dim.key === 'cost') {
          // Collect descendant costs
          const branchDescendants = (Object.values(tree.nodes) as DecisionTreeNode[])
            .filter(n => isDescendant(n.id, branch.id));
          const totalCost = branchDescendants.reduce((sum, n) => sum + (n.cost ?? 0), 0) + (branch.cost ?? 0);
          score = Math.max(15, Math.min(100, 100 - (totalCost / 800) * 80));
        } else if (dim.key === 'risk') {
          // Sum of joint probabilities of terminal outcomes with payoff < 0
          const lossProb = branchTerminals
            .filter(t => (t.payoff ?? 0) < 0)
            .reduce((sum, t) => sum + getJointProbability(t.id), 0);
          score = Math.max(10, Math.min(100, (1 - lossProb) * 100));
        } else if (dim.key === 'cap') {
          const maxPayoff = Math.max(...branchTerminals.map(t => t.payoff ?? 0), 0);
          score = Math.max(10, Math.min(100, (maxPayoff / globalMaxPayoff) * 100));
        }

        dataPoint[branch.name] = Math.round(score);
      });

      return dataPoint;
    });
  }, [tree, topBranches, solvedNodes]);

  // Color scheme for the different branches
  const branchColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  // --- SINGLE FACTOR SENSITIVITY LINE SWEEP LOGIC ---
  const sweepableNodes = useMemo(() => {
    const list: { 
      id: string; 
      name: string; 
      type: 'PROBABILITY' | 'COST' | 'PAYOFF'; 
      key: string;
      label: string; 
      currentVal: number;
    }[] = [];

    (Object.values(tree.nodes) as DecisionTreeNode[]).forEach(n => {
      if (n.parentId && tree.nodes[n.parentId]?.type === 'CHANCE') {
        list.push({
          id: n.id,
          name: n.name,
          type: 'PROBABILITY',
          key: `${n.id}:PROBABILITY`,
          label: `[概率] ${tree.nodes[n.parentId].name} ➔ ${n.name}`,
          currentVal: n.probability ?? 0
        });
      }
      if (n.cost !== undefined) {
        list.push({
          id: n.id,
          name: n.name,
          type: 'COST',
          key: `${n.id}:COST`,
          label: `[追加成本] ${n.name} 的研发/追加成本`,
          currentVal: n.cost
        });
      }
      if (n.type === 'TERMINAL') {
        list.push({
          id: n.id,
          name: n.name,
          type: 'PAYOFF',
          key: `${n.id}:PAYOFF`,
          label: `[终点损益] ${n.name} 的净值回报`,
          currentVal: n.payoff ?? 0
        });
      }
    });
    return list;
  }, [tree]);

  const [selectedSweepKey, setSelectedSweepKey] = useState<string>('');
  
  useEffect(() => {
    if (sweepableNodes.length > 0 && (!selectedSweepKey || !sweepableNodes.some(x => x.key === selectedSweepKey))) {
      // Prefer an R&D Success probability or fallback to first
      const hasRdSuccess = sweepableNodes.find(x => x.id === 'rd_success' && x.type === 'PROBABILITY');
      setSelectedSweepKey(hasRdSuccess ? hasRdSuccess.key : sweepableNodes[0].key);
    }
  }, [sweepableNodes, selectedSweepKey]);

  const activeSweepItem = useMemo(() => {
    return sweepableNodes.find(x => x.key === selectedSweepKey);
  }, [sweepableNodes, selectedSweepKey]);

  // Live sweep parameter value state
  const [liveSweepValue, setLiveSweepValue] = useState<number>(0);

  useEffect(() => {
    if (activeSweepItem) {
      setLiveSweepValue(activeSweepItem.currentVal);
    }
  }, [activeSweepItem]);

  // Calculate live line sweep data based on liveSweepValue
  const lineChartData = useMemo(() => {
    if (!activeSweepItem) return [];
    
    // Vary the parameter from min to max across 11 increments
    let minVal = 0;
    let maxVal = 1;
    if (activeSweepItem.type === 'COST') {
      minVal = 0;
      maxVal = Math.max(1000, activeSweepItem.currentVal * 2.5);
    } else if (activeSweepItem.type === 'PAYOFF') {
      minVal = activeSweepItem.currentVal < 0 ? activeSweepItem.currentVal * 2.5 : 0;
      maxVal = activeSweepItem.currentVal < 0 ? 0 : Math.max(2500, activeSweepItem.currentVal * 2.5);
    }

    const stepSize = (maxVal - minVal) / 10;
    const points = [];

    for (let i = 0; i <= 10; i++) {
      const sweepVal = minVal + i * stepSize;
      const roundedSweepVal = Math.round(sweepVal * 100) / 100;
      
      const clonedTree = JSON.parse(JSON.stringify(tree)) as DecisionTree;
      const nodes = clonedTree.nodes;

      if (activeSweepItem.type === 'PROBABILITY') {
        const nodeToSet = nodes[activeSweepItem.id];
        if (nodeToSet && nodeToSet.parentId) {
          nodeToSet.probability = roundedSweepVal;

          // Balance sibling probabilities
          const parentId = nodeToSet.parentId;
          const siblings = Object.values(nodes).filter((n: any) => n.parentId === parentId && n.id !== activeSweepItem.id) as DecisionTreeNode[];
          if (siblings.length > 0) {
            const sumSibs = siblings.reduce((acc, curr) => acc + (curr.probability || 0), 0);
            const remaining = 1.0 - roundedSweepVal;
            if (sumSibs > 0) {
              const scale = remaining / sumSibs;
              siblings.forEach(sib => {
                nodes[sib.id].probability = Math.max(0, Math.round((sib.probability || 0) * scale * 100) / 100);
              });
            } else {
              siblings.forEach(sib => {
                nodes[sib.id].probability = Math.max(0, Math.round((remaining / siblings.length) * 100) / 100);
              });
            }
          }
        }
      } else if (activeSweepItem.type === 'COST') {
        const nodeToSet = nodes[activeSweepItem.id];
        if (nodeToSet) nodeToSet.cost = roundedSweepVal;
      } else {
        const nodeToSet = nodes[activeSweepItem.id];
        if (nodeToSet) nodeToSet.payoff = roundedSweepVal;
      }

      const solved = runBackwardInduction(clonedTree);
      const rootChildren = Object.values(solved).filter(rc => rc.parentId === clonedTree.rootId);

      const pt: any = {
        parameterValue: activeSweepItem.type === 'PROBABILITY' ? `${Math.round(roundedSweepVal * 100)}%` : roundedSweepVal,
        rawParam: roundedSweepVal
      };

      rootChildren.forEach(rc => {
        pt[rc.name] = Math.round(((rc.emv ?? 0) - (rc.cost ?? 0)) * 10) / 10;
      });

      points.push(pt);
    }
    return points;
  }, [tree, activeSweepItem]);


  // ===================================
  // 2. RIGHT SCREEN: MONTE CARLO SIMULATION & OUTCOMES HISTOGRAM
  // ===================================

  const [simPlaying, setSimPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(40); // ms per step
  const [simRunsCount, setSimRunsCount] = useState<number>(0);
  const [simHistory, setSimHistory] = useState<number[]>([]);
  const [particles, setParticles] = useState<SimParticle[]>([]);
  const lastParticleIdRef = useRef<number>(0);

  // Initialize outcomes histogram bins
  const payoffBins = useMemo(() => {
    const payoffs = (Object.values(tree.nodes) as DecisionTreeNode[])
      .filter(n => n.type === 'TERMINAL')
      .map(n => n.payoff ?? 0);
    
    const minPayoff = Math.min(...payoffs, -300);
    const maxPayoff = Math.max(...payoffs, 1800);
    const range = maxPayoff - minPayoff;
    const countBins = 5;
    const step = Math.ceil(range / countBins);

    const b = [];
    for (let i = 0; i < countBins; i++) {
      const start = minPayoff + i * step;
      const end = minPayoff + (i + 1) * step;
      b.push({
        id: i,
        rangeStr: `¥${start}-${end}万`,
        start,
        end,
        count: 0
      });
    }
    return b;
  }, [tree]);

  const [liveBinCounts, setLiveBinCounts] = useState<Record<number, number>>({});

  const formattedHistogramData = useMemo(() => {
    return payoffBins.map(bin => ({
      range: bin.rangeStr,
      频率: liveBinCounts[bin.id] ?? 0,
      start: bin.start,
      end: bin.end
    }));
  }, [payoffBins, liveBinCounts]);

  // Statistics of simulation outcomes
  const simStats = useMemo(() => {
    if (simHistory.length === 0) return { mean: 0, std: 0, max: 0, min: 0, lossProb: 0 };
    const sum = simHistory.reduce((a, b) => a + b, 0);
    const mean = sum / simHistory.length;
    
    const variance = simHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / simHistory.length;
    const std = Math.sqrt(variance);
    const max = Math.max(...simHistory);
    const min = Math.min(...simHistory);
    const losses = simHistory.filter(x => x < 0).length;
    const lossProb = losses / simHistory.length;

    return { mean, std, max, min, lossProb };
  }, [simHistory]);

  // Create a neat mini horizontal tree layout for drawing simulated pathways
  const miniTreeLayout = useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    const nodeLevels: Record<string, number> = {};

    const getDepth = (id: string): number => {
      if (nodeLevels[id] !== undefined) return nodeLevels[id];
      const node = tree.nodes[id];
      if (!node || !node.parentId) {
        nodeLevels[id] = 0;
        return 0;
      }
      const d = getDepth(node.parentId) + 1;
      nodeLevels[id] = d;
      return d;
    };

    Object.keys(tree.nodes).forEach(id => getDepth(id));

    const levels: Record<number, string[]> = {};
    Object.entries(nodeLevels).forEach(([id, lvl]) => {
      if (!levels[lvl]) levels[lvl] = [];
      levels[lvl].push(id);
    });

    const maxLvl = Math.max(...Object.keys(levels).map(Number), 0);
    const canvasWidth = 320;
    const canvasHeight = 150;
    const paddingX = 35;
    const paddingY = 20;

    Object.entries(levels).forEach(([lvlStr, ids]) => {
      const lvl = Number(lvlStr);
      const x = paddingX + (lvl / (maxLvl || 1)) * (canvasWidth - 2 * paddingX);
      ids.forEach((id, idx) => {
        const y = paddingY + ((idx + 0.5) / ids.length) * (canvasHeight - 2 * paddingY);
        coords[id] = { x, y };
      });
    });

    return coords;
  }, [tree]);

  // Run a single Monte Carlo traversal down the tree
  const sampleOneTrial = (): { terminalId: string; payoff: number; path: string[] } => {
    let currentId = tree.rootId;
    const path: string[] = [currentId];
    let costAccumulated = 0;

    while (true) {
      const node = tree.nodes[currentId];
      if (!node) break;

      if (node.cost) {
        costAccumulated += node.cost;
      }

      if (node.type === 'TERMINAL') {
        const finalPayoff = (node.payoff ?? 0) - costAccumulated;
        return { terminalId: currentId, payoff: finalPayoff, path };
      }

      const children = (Object.values(tree.nodes) as DecisionTreeNode[])
        .filter(n => n.parentId === currentId);
      
      if (children.length === 0) {
        return { terminalId: currentId, payoff: (node.payoff ?? 0) - costAccumulated, path };
      }

      if (node.type === 'DECISION') {
        // Find the optimal decision (unpruned)
        const unprunedChild = children.find(c => !solvedNodes[c.id]?.isPruned);
        const nextNode = unprunedChild || children[0];
        currentId = nextNode.id;
        path.push(currentId);
      } else if (node.type === 'CHANCE') {
        // Probability weighted roll
        const totalProb = children.reduce((sum, c) => sum + (c.probability ?? 0), 0);
        let roll = Math.random() * (totalProb || 1);
        let selected = children[0];
        for (const child of children) {
          roll -= (child.probability ?? 0);
          if (roll <= 0) {
            selected = child;
            break;
          }
        }
        currentId = selected.id;
        path.push(currentId);
      } else {
        break;
      }
    }

    return { terminalId: currentId, payoff: 0, path };
  };

  // Main simulation timer tick
  useEffect(() => {
    if (!simPlaying) return;

    const interval = setInterval(() => {
      // 1. Spawning new particles if under 100 runs limit
      setParticles(prev => {
        let updated = prev.map(p => {
          const nextProgress = p.progress + 0.12; // Speed of flow
          if (nextProgress >= 1.0) {
            const nextStep = p.step + 1;
            if (nextStep >= p.path.length - 1) {
              // Particle has reached the end! Record payoff
              const endNodeId = p.path[p.path.length - 1];
              const node = tree.nodes[endNodeId];
              
              // Compute payoff minus path cost
              let pathCost = 0;
              p.path.forEach(nodeId => {
                const n = tree.nodes[nodeId];
                if (n && n.cost) pathCost += n.cost;
              });
              const payoffVal = (node?.payoff ?? 0) - pathCost;

              // Log results
              setSimRunsCount(rc => {
                const nextRc = rc + 1;
                if (nextRc >= 100) {
                  setSimPlaying(false); // Finished 100 runs
                }
                return nextRc;
              });

              setSimHistory(hist => [...hist, payoffVal]);

              // Bucket into appropriate bin
              setLiveBinCounts(counts => {
                const matchedBin = payoffBins.find(b => payoffVal >= b.start && payoffVal < b.end);
                if (matchedBin) {
                  return {
                    ...counts,
                    [matchedBin.id]: (counts[matchedBin.id] ?? 0) + 1
                  };
                }
                // Fallback to closest bin
                return counts;
              });

              return null; // Flag to discard this finished particle
            }
            return { ...p, step: nextStep, progress: 0 };
          }
          return { ...p, progress: nextProgress };
        }).filter((p): p is SimParticle => p !== null);

        // Spawn a new particle if we haven't reached 100 simulations yet
        if (simRunsCount + updated.length < 100) {
          const trial = sampleOneTrial();
          lastParticleIdRef.current += 1;
          
          // Randomly choose a color for distinction
          const colors = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#c084fc'];
          const randColor = colors[Math.floor(Math.random() * colors.length)];

          updated.push({
            id: lastParticleIdRef.current,
            path: trial.path,
            step: 0,
            progress: 0,
            color: randColor
          });
        }

        return updated;
      });
    }, simSpeed);

    return () => clearInterval(interval);
  }, [simPlaying, simRunsCount, simSpeed, tree, solvedNodes, payoffBins]);

  // Reset simulation states
  const handleResetSim = () => {
    setSimPlaying(false);
    setSimRunsCount(0);
    setSimHistory([]);
    setParticles([]);
    setLiveBinCounts({});
    lastParticleIdRef.current = 0;
  };

  // Immediate "Instant Complete" running
  const handleInstantSim = () => {
    handleResetSim();
    
    const outcomes: number[] = [];
    const binCounts: Record<number, number> = {};

    for (let i = 0; i < 100; i++) {
      const trial = sampleOneTrial();
      outcomes.push(trial.payoff);

      const matchedBin = payoffBins.find(b => trial.payoff >= b.start && trial.payoff < b.end);
      if (matchedBin) {
        binCounts[matchedBin.id] = (binCounts[matchedBin.id] ?? 0) + 1;
      }
    }

    setSimHistory(outcomes);
    setSimRunsCount(100);
    setLiveBinCounts(binCounts);
  };

  return (
    <div id="collab-sandbox-panel" className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 border border-indigo-100">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              高级项目风险量化与参数敏感度实验室
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">提供多维因子蛛网评估、单因素动态插值扫频以及百次蒙特卡洛粒子堆叠直方图</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => onCloneScenario(`派生备选场景-${scenariosList.length + 1}`)}
            className="p-1.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>派生新决策场景</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 leading-relaxed">
        
        {/* ==================== LEFT COMPONENT: SENSITIVITY ANALYSIS CHART ==================== */}
        <div className="border border-slate-150 rounded-2xl p-4.5 space-y-4 bg-slate-50/40 relative">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                动态敏感性分析模型 (Sensitivity Analysis)
              </h4>
            </div>

            {/* Mode selection toggles */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/50">
              <button
                onClick={() => setSensitivityMode('radar')}
                className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                  sensitivityMode === 'radar' 
                    ? 'bg-white text-indigo-600 shadow-3xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                多维风险雷达
              </button>
              <button
                onClick={() => setSensitivityMode('line')}
                className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md transition-all cursor-pointer ${
                  sensitivityMode === 'line' 
                    ? 'bg-white text-indigo-600 shadow-3xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                单因素扫频折线
              </button>
            </div>
          </div>

          {/* Sub-panels */}
          {sensitivityMode === 'radar' ? (
            <div className="space-y-4">
              <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-100 flex items-start gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  <strong>蛛网图解释：</strong>针对所有最上游的主要决策分支，综合评估了其在期望回报、极端成功率、追加开发成本控制、下行防守弹性和整体回报上限五个维度的表现分（得分越高越优）。
                </span>
              </div>

              {/* Radar Chart Container */}
              <div className="h-[210px] w-full flex items-center justify-center bg-white border border-slate-150 rounded-2xl relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} />
                    
                    {topBranches.map((branch, idx) => (
                      <Radar
                        key={branch.id}
                        name={branch.name}
                        dataKey={branch.name}
                        stroke={branchColors[idx % branchColors.length]}
                        fill={branchColors[idx % branchColors.length]}
                        fillOpacity={0.25}
                      />
                    ))}
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: '10px', marginTop: '5px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Value metrics checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {topBranches.map((branch, idx) => {
                  const branchEmv = solvedNodes[branch.id]?.emv ?? branch.payoff ?? 0;
                  return (
                    <div key={branch.id} className="bg-white border border-slate-150 p-2.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: branchColors[idx % branchColors.length] }} />
                        <span className="font-bold text-slate-700 truncate" title={branch.name}>{branch.name}</span>
                      </div>
                      <span className="font-mono font-extrabold text-slate-900 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        ¥{Math.round(branchEmv)}万
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            <div className="space-y-4">
              {/* Line Sweep Parameter Controls */}
              <div className="bg-white p-3 rounded-2xl border border-slate-150 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                    <span>扫频模拟变量</span>
                  </label>
                  
                  <select
                    value={selectedSweepKey}
                    onChange={(e) => setSelectedSweepKey(e.target.value)}
                    className="text-[10.5px] p-1.5 border border-slate-200 rounded-lg bg-white font-bold text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[200px]"
                  >
                    {sweepableNodes.map(item => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </div>

                {activeSweepItem && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="text-slate-500">动态调节设定值:</span>
                      <strong className="text-indigo-600 font-mono">
                        {activeSweepItem.type === 'PROBABILITY' 
                          ? `${Math.round(liveSweepValue * 100)}%` 
                          : `¥${Math.round(liveSweepValue)}万`
                        }
                      </strong>
                    </div>
                    
                    <input
                      type="range"
                      min={activeSweepItem.type === 'PROBABILITY' ? 0 : 0}
                      max={activeSweepItem.type === 'PROBABILITY' ? 1 : activeSweepItem.type === 'COST' ? Math.max(1000, activeSweepItem.currentVal * 2.5) : Math.max(2500, activeSweepItem.currentVal * 2.5)}
                      step={activeSweepItem.type === 'PROBABILITY' ? 0.05 : 20}
                      value={liveSweepValue}
                      onChange={(e) => setLiveSweepValue(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                    />
                    
                    <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                      <span>最小值: {activeSweepItem.type === 'PROBABILITY' ? '0%' : '¥0万'}</span>
                      <span>当前默认: {activeSweepItem.type === 'PROBABILITY' ? `${Math.round(activeSweepItem.currentVal * 100)}%` : `¥${activeSweepItem.currentVal}万`}</span>
                      <span>最大值: {activeSweepItem.type === 'PROBABILITY' ? '100%' : `¥${Math.round(activeSweepItem.type === 'COST' ? Math.max(1000, activeSweepItem.currentVal * 2.5) : Math.max(2500, activeSweepItem.currentVal * 2.5))}万`}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Line Chart Area */}
              <div className="h-[200px] w-full bg-white border border-slate-150 rounded-2xl relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="parameterValue" 
                      tick={{ fill: '#64748b', fontSize: 9, fontWeight: 500 }}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 9 }} 
                      unit="w"
                    />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: '9px', marginTop: '4px' }} />
                    
                    {topBranches.map((branch, idx) => (
                      <Line
                        key={branch.id}
                        type="monotone"
                        dataKey={branch.name}
                        stroke={branchColors[idx % branchColors.length]}
                        strokeWidth={2.5}
                        activeDot={{ r: 5 }}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>

        {/* ==================== RIGHT COMPONENT: MONTE CARLO RANDOM PATH SIMULATOR ==================== */}
        <div className="border border-slate-150 rounded-2xl p-4.5 space-y-4 bg-slate-50/40 relative">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                蒙特卡洛随机模拟实验室 (Monte Carlo Simulation)
              </h4>
            </div>

            {/* Play controls */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => setSimPlaying(!simPlaying)}
                disabled={simRunsCount >= 100}
                className={`p-1.5 px-3 rounded-lg flex items-center gap-1 text-[11px] font-extrabold cursor-pointer transition-all shadow-3xs border disabled:opacity-50 disabled:cursor-not-allowed ${
                  simPlaying
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {simPlaying ? <Pause className="w-3 h-3 fill-rose-600 text-rose-600" /> : <Play className="w-3 h-3 fill-white text-white" />}
                <span>{simPlaying ? '暂停模拟' : simRunsCount >= 100 ? '模拟完成' : '播放百次模拟'}</span>
              </button>

              <button
                onClick={handleInstantSim}
                disabled={simRunsCount >= 100 || simPlaying}
                className="p-1.5 px-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-[11px] font-bold text-slate-600 transition-all disabled:opacity-50 cursor-pointer"
                title="瞬间跑完100次计算并输出结果"
              >
                闪电快跑 ⚡
              </button>

              <button
                onClick={handleResetSim}
                className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
                title="清空模拟记录"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* Playback Path visualizer box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between h-[195px] relative overflow-hidden shadow-inner">
              <div className="absolute top-2.5 left-3 text-[9px] font-mono font-bold text-slate-500 flex items-center gap-1.5 z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>实时决策路径渗流拓扑</span>
              </div>

              <div className="absolute top-2.5 right-3 text-[10px] font-mono text-emerald-400 font-extrabold bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 z-10">
                运行记录: {simRunsCount}/100 次
              </div>

              {/* Minimalist decision paths SVG container */}
              <div className="w-full h-full flex items-center justify-center pt-4">
                <svg width="100%" height="100%" viewBox="0 0 320 150">
                  {/* Connective Link lines */}
                  {(Object.values(tree.nodes) as DecisionTreeNode[]).map(node => {
                    if (!node.parentId) return null;
                    const start = (miniTreeLayout as Record<string, { x: number; y: number }>)[node.parentId];
                    const end = (miniTreeLayout as Record<string, { x: number; y: number }>)[node.id];
                    if (!start || !end) return null;

                    const isGoldenLink = !node.isPruned && (solvedNodes[node.parentId]?.isPruned === false || node.parentId === tree.rootId);
                    
                    return (
                      <line
                        key={`link-${node.id}`}
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={isGoldenLink ? '#34d399' : '#475569'}
                        strokeWidth={isGoldenLink ? 1.5 : 0.8}
                        strokeDasharray={node.isPruned ? '2,2' : undefined}
                        opacity={node.isPruned ? 0.25 : 0.6}
                      />
                    );
                  })}

                  {/* Nodes circles */}
                  {Object.entries(miniTreeLayout as Record<string, { x: number; y: number }>).map(([id, coord]) => {
                    const node = tree.nodes[id];
                    if (!node) return null;
                    
                    const isOptimal = id === tree.rootId || !solvedNodes[id]?.isPruned;
                    const fill = node.type === 'DECISION' ? '#6366f1' : node.type === 'CHANCE' ? '#f59e0b' : '#10b981';

                    return (
                      <g key={`nodeg-${id}`}>
                        <circle
                          cx={coord.x}
                          cy={coord.y}
                          r={node.type === 'TERMINAL' ? 3.5 : 5}
                          fill={fill}
                          stroke="#0f172a"
                          strokeWidth="1"
                          opacity={isOptimal ? 1 : 0.35}
                        />
                        {/* Compact text labels on terminal outcome nodes */}
                        {node.type === 'TERMINAL' && (
                          <text
                            x={coord.x + 5}
                            y={coord.y + 2.5}
                            fill="#94a3b8"
                            fontSize="6"
                            className="font-mono scale-90"
                          >
                            ¥{node.payoff}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Flowing simulated glowing particles */}
                  {particles.map(particle => {
                    const startNode = particle.path[particle.step];
                    const endNode = particle.path[particle.step + 1];
                    const startCoord = miniTreeLayout[startNode];
                    const endCoord = miniTreeLayout[endNode];

                    if (!startCoord || !endCoord) return null;

                    const curX = startCoord.x + (endCoord.x - startCoord.x) * particle.progress;
                    const curY = startCoord.y + (endCoord.y - startCoord.y) * particle.progress;

                    return (
                      <g key={`particle-${particle.id}`}>
                        {/* Glow filter aura */}
                        <circle
                          cx={curX}
                          cy={curY}
                          r="5.5"
                          fill={particle.color}
                          opacity="0.35"
                          className="animate-ping"
                        />
                        <circle
                          cx={curX}
                          cy={curY}
                          r="2.5"
                          fill={particle.color}
                          stroke="#ffffff"
                          strokeWidth="0.8"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Status footer inside visualizer */}
              <div className="text-[9.5px] text-slate-400 font-mono flex justify-between">
                <span>🟢 绿圆：结局模型</span>
                <span>🔵 蓝：决策点</span>
                <span>🟡 橙：机会点</span>
              </div>
            </div>

            {/* Realtime stacking histogram frequency box */}
            <div className="bg-white border border-slate-150 rounded-2xl p-3 flex flex-col justify-between h-[195px] relative overflow-hidden shadow-xs">
              <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>下游回报概率分布直方图 (Histogram)</span>
              </div>

              <div className="flex-1 w-full min-h-[120px]">
                {simHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-6">
                    <AlertCircle className="w-6 h-6 text-slate-300 mb-1" />
                    <span className="text-[10px] max-w-[140px] leading-relaxed">暂无模拟点，点击“播放”观看彩色小球流淌堆叠</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedHistogramData} margin={{ top: 10, right: 10, left: -25, bottom: -5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                      <XAxis 
                        dataKey="range" 
                        tick={{ fill: '#64748b', fontSize: 8, fontWeight: 700 }}
                      />
                      <YAxis tick={{ fill: '#64748b', fontSize: 8 }} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                      <Bar 
                        dataKey="频率" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]}
                        animationDuration={300}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Bottom dashboard grid for simulation statistics */}
          <div className="bg-white border border-slate-150 p-3 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-center divide-x divide-slate-100">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold block">平均收益均值 (Mean)</span>
              <strong className="text-sm font-black text-slate-800 font-mono">
                {simHistory.length > 0 ? `¥${simStats.mean.toFixed(1)}万` : '¥0.0万'}
              </strong>
            </div>

            <div className="space-y-0.5 pl-2">
              <span className="text-[10px] text-slate-400 font-bold block">收益离散标准差 (Std)</span>
              <strong className="text-sm font-black text-slate-800 font-mono">
                {simHistory.length > 0 ? `¥${simStats.std.toFixed(1)}万` : '¥0.0万'}
              </strong>
            </div>

            <div className="space-y-0.5 pl-2">
              <span className="text-[10px] text-slate-400 font-bold block">极端净盈亏界限</span>
              <span className="text-[10.5px] font-mono text-slate-600 block leading-tight">
                {simHistory.length > 0 ? `${Math.round(simStats.min)}w ~ ${Math.round(simStats.max)}w` : '¥0w'}
              </span>
            </div>

            <div className="space-y-0.5 pl-2">
              <span className="text-[10px] text-slate-400 font-bold block">亏损发生概率 (Value-at-Risk)</span>
              <strong className={`text-sm font-black font-mono block ${simStats.lossProb > 0.2 ? 'text-red-500' : 'text-emerald-600'}`}>
                {simHistory.length > 0 ? `${(simStats.lossProb * 100).toFixed(1)}%` : '0.0%'}
              </strong>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
