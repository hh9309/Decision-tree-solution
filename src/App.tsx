import { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, Sliders, Play, Settings, RefreshCw, Layers, 
  HelpCircle, CheckCircle, Flame, Plus, Briefcase, FileSignature, Compass,
  Terminal, BookOpen, Copy, Check, Code, Cpu, ChevronRight, X, Info,
  Undo2, Redo2
} from 'lucide-react';
import { Scenario, DecisionTreeNode, NodeType } from './types';

// Real Python solver code generator
const generatePythonCode = (treeNodes: Record<string, DecisionTreeNode>, rootId: string, scenarioName: string) => {
  const simplNodes = Object.values(treeNodes).map(n => ({
    id: n.id,
    name: n.name,
    type: n.type,
    parentId: n.parentId || null,
    probability: n.probability !== undefined ? n.probability : null,
    payoff: n.payoff !== undefined ? n.payoff : null,
    cost: n.cost || 0
  }));

  // Format as valid Python dictionary literals by converting null/true/false to None/True/False
  const pythonNodesLiteral = JSON.stringify(simplNodes, null, 4)
    .replace(/:\s*null\b/g, ': None')
    .replace(/:\s*true\b/g, ': True')
    .replace(/:\s*false\b/g, ': False');

  return `# -*- coding: utf-8 -*-
"""
OR-Tree 决策树逆向归纳求解脚本 (Operational Research Solver)
方案名称: ${scenarioName}
生成时间: ${new Date().toISOString().slice(0, 10)}
"""

# 兼容性定义（防止外部执行环境或自定义扩展数据中出现 JS 风格常量）
null = None
true = True
false = False

# 决策树拓扑与参数矩阵定义 (节点数: ${Object.keys(treeNodes).length})
DECISION_TREE_NODES = ${pythonNodesLiteral}

def solve_decision_tree(nodes_list, root_id="${rootId}"):
    """
    基于期望货币价值 (EMV) 与动态规划逆向归纳算法 (Backward Induction) 求解最优决策路径
    """
    db = {n["id"]: n for n in nodes_list}
    children_map = {}
    for n in nodes_list:
        p_id = n.get("parentId")
        if p_id:
            children_map.setdefault(p_id, []).append(n)

    computed_emv = {}
    optimal_choices = {}
    pruned_nodes = set()

    def get_emv(node_id):
        if node_id in computed_emv:
            return computed_emv[node_id]

        node = db.get(node_id)
        if not node:
            return 0.0

        children = children_map.get(node_id, [])

        # 终点或无子节点: 直接返回收益净值
        if node["type"] == "TERMINAL" or not children:
            val = float(node["payoff"] if node.get("payoff") is not None else 0.0)
            computed_emv[node_id] = round(val, 2)
            return computed_emv[node_id]

        if node["type"] == "CHANCE":
            # 机会点: 加权平均 EMV = sum(P_i * (EMV_child_i - Cost_child_i))
            emv_val = 0.0
            total_prob = 0.0
            for child in children:
                prob = float(child["probability"] if child.get("probability") is not None else 0.0)
                total_prob += prob
                child_val = get_emv(child["id"]) - float(child.get("cost") or 0.0)
                emv_val += prob * child_val
            
            # 概率归一化处理（若总概率不为0但略有浮动）
            if total_prob > 0 and abs(total_prob - 1.0) > 0.001:
                emv_val = emv_val / total_prob

            computed_emv[node_id] = round(emv_val, 2)
            return computed_emv[node_id]

        elif node["type"] == "DECISION":
            # 决策点: 选最大净期望 max(EMV_child - Cost_child)
            options = []
            for child in children:
                child_val = get_emv(child["id"]) - float(child.get("cost") or 0.0)
                options.append((child["id"], child["name"], child_val))

            if not options:
                computed_emv[node_id] = 0.0
                return 0.0

            best_opt = max(options, key=lambda x: x[2])
            optimal_choices[node_id] = best_opt

            # 标记剪枝分支
            for opt_id, opt_name, _ in options:
                if opt_id != best_opt[0]:
                    pruned_nodes.add(opt_id)

            computed_emv[node_id] = round(best_opt[2], 2)
            return computed_emv[node_id]

        computed_emv[node_id] = 0.0
        return 0.0

    print("=" * 65)
    print(f"🌲 OR-Tree 决策树逆向归纳计算仿真")
    print(f"方案: {${JSON.stringify(scenarioName)}} | 根节点: {root_id}")
    print(f"总节点数: {len(nodes_list)}")
    print("-" * 65)

    final_emv = get_emv(root_id)

    print("\\n📊 各节点期望货币价值 (EMV) 计算结果:")
    for n in nodes_list:
        n_id = n["id"]
        emv = computed_emv.get(n_id, 0.0)
        n_type = n["type"]
        is_pruned = " [❌ 剪枝丢弃]" if n_id in pruned_nodes else ""
        print(f"  - [{n_type:<8}] {n['name']} (ID: {n_id}): EMV = ¥ {emv} 万元{is_pruned}")

    if optimal_choices:
        print("\\n🎯 最优决策行动路径推荐 (Optimal Policy):")
        for dec_id, best in optimal_choices.items():
            dec_node = db.get(dec_id, {})
            print(f"  ★ 在决策点 [{dec_node.get('name', dec_id)}] ➔ 优选: [{best[1]}] (分支期望净值: ¥ {round(best[2], 2)} 万元)")

    print("\\n" + "=" * 65)
    print(f"🏆 顶层全局最优平均期望净收益: ¥ {final_emv} 万元")
    print("=" * 65)

    return {
        "final_emv": final_emv,
        "computed_emv": computed_emv,
        "optimal_choices": optimal_choices
    }

if __name__ == "__main__":
    solve_decision_tree(DECISION_TREE_NODES, "${rootId}")
`;
};
import { createDefaultTree } from './defaultTree';
import { runBackwardInduction } from './treeEngine';

// Components
import { NodeEditor } from './components/NodeEditor';
import { TopologyCanvas } from './components/TopologyCanvas';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { InsightsDashboard } from './components/InsightsDashboard';
import { ScenarioDiff } from './components/ScenarioDiff';
import { AutoOptimizer } from './components/AutoOptimizer';

export default function App() {
  // Scenario lists
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: 'scenario-aggressive',
      name: '芯片立项: 自主攻坚路线 (推荐)',
      description: '公司智能 IoT 芯片项目的战略大盘。初始投资45万元，包含后续激进营销与众筹定制下的市场弹性结局。环境契合度高。',
      version: 'v1.1',
      tree: createDefaultTree()
    },
    {
      id: 'scenario-conservative',
      name: '芯片立项: 保守微调路线',
      description: '对独立研发成功率估算下调的防御型分析（研发成功率调整为55%，追加大渠道宣发成本限制为150万）。',
      version: 'v1.0',
      tree: (() => {
        const conservativeTree = createDefaultTree();
        // modify some default probabilities and payouts to offer immediate comparison differences
        if (conservativeTree.nodes['rd_success']) {
          conservativeTree.nodes['rd_success'].probability = 0.55;
        }
        if (conservativeTree.nodes['rd_fail']) {
          conservativeTree.nodes['rd_fail'].probability = 0.45;
        }
        if (conservativeTree.nodes['agg_low_demand']) {
          conservativeTree.nodes['agg_low_demand'].payoff = 300;
        }
        return conservativeTree;
      })()
    }
  ]);

  // Undo / Redo dynamic operation history stacks
  const [historyUndo, setHistoryUndo] = useState<Scenario[][]>([]);
  const [historyRedo, setHistoryRedo] = useState<Scenario[][]>([]);

  // Wrap setScenarios to record state changes
  const updateScenariosWithHistory = (updater: Scenario[] | ((prev: Scenario[]) => Scenario[])) => {
    setScenarios(prev => {
      const nextState = typeof updater === 'function' ? updater(prev) : updater;
      if (JSON.stringify(prev) !== JSON.stringify(nextState)) {
        const clonedPrev = JSON.parse(JSON.stringify(prev));
        setHistoryUndo(stack => [...stack, clonedPrev]);
        setHistoryRedo([]); // clear redo stack on new progressive actions
      }
      return nextState;
    });
  };

  const handleUndo = () => {
    if (historyUndo.length === 0) return;
    setHistoryUndo(stack => {
      const newStack = [...stack];
      const previousState = newStack.pop()!;
      setScenarios(current => {
        const clonedCurrent = JSON.parse(JSON.stringify(current));
        setHistoryRedo(redoStack => [...redoStack, clonedCurrent]);
        return previousState;
      });
      return newStack;
    });
  };

  const handleRedo = () => {
    if (historyRedo.length === 0) return;
    setHistoryRedo(stack => {
      const newStack = [...stack];
      const nextState = newStack.pop()!;
      setScenarios(current => {
        const clonedCurrent = JSON.parse(JSON.stringify(current));
        setHistoryUndo(undoStack => [...undoStack, clonedCurrent]);
        return nextState;
      });
      return newStack;
    });
  };

  const [currentScenarioId, setCurrentScenarioId] = useState<string>('scenario-aggressive');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Active current scenario
  const currentScenario = useMemo(() => {
    return scenarios.find(sc => sc.id === currentScenarioId) || scenarios[0];
  }, [scenarios, currentScenarioId]);

  // Compute EMV backward induction on active tree
  const solvedNodes = useMemo(() => {
    return runBackwardInduction(currentScenario.tree);
  }, [currentScenario]);

  // 3个切片交互 modal 状态 & 仿真变量
  const [activeModal, setActiveModal] = useState<'python' | 'knowledge' | null>(null);
  const [pySimulating, setPySimulating] = useState<boolean>(false);
  const [pyLogs, setPyLogs] = useState<string[]>([]);
  const [pyCopied, setPyCopied] = useState<boolean>(false);

  const pythonCode = useMemo(() => {
    return generatePythonCode(currentScenario.tree.nodes, currentScenario.tree.rootId, currentScenario.name);
  }, [currentScenario]);

  const handleRunPySimulation = () => {
    if (pySimulating) return;
    setPySimulating(true);
    setPyLogs([]);
    
    const nodeCount = Object.keys(currentScenario.tree.nodes).length;
    const rootEmv = solvedNodes[currentScenario.tree.rootId]?.emv ?? 0;
    
    const sequence = [
      `$ python solver.py --scenario="${currentScenario.id}"`,
      `[sys] Loading operational research libraries (numpy, scipy)...`,
      `[sys] Building tree structure index for rootId="${currentScenario.tree.rootId}"`,
      `[info] Detected ${nodeCount} active nodes in tree. Running recursive Backward Induction...`,
      `[solver] Calculated Expected Monetary Values sequentially:`,
      ...(Object.values(solvedNodes) as DecisionTreeNode[])
        .filter(n => n.type !== 'TERMINAL')
        .slice(0, 4)
        .map(n => `  - Evaluated [${n.name}]: EMV = ¥${n.emv}w`),
      `[solver] Backtracking solved node values upwards to root...`,
      `🎯 Success! Max EMV found: ¥ ${rootEmv} 万元.`
    ];

    sequence.forEach((line, index) => {
      setTimeout(() => {
        setPyLogs(prev => [...prev, line]);
        if (index === sequence.length - 1) {
          setPySimulating(false);
        }
      }, index * 200);
    });
  };

  // Node hierarchy parent pointer lookup
  const selectedNodeWithDetails = useMemo(() => {
    if (!selectedNodeId) return null;
    return solvedNodes[selectedNodeId] || null;
  }, [selectedNodeId, solvedNodes]);

  const parentNode = useMemo(() => {
    if (!selectedNodeWithDetails || !selectedNodeWithDetails.parentId) return null;
    return solvedNodes[selectedNodeWithDetails.parentId] || null;
  }, [selectedNodeWithDetails, solvedNodes]);

  const nodeSiblings = useMemo(() => {
    if (!selectedNodeWithDetails || !selectedNodeWithDetails.parentId) return [];
    return (Object.values(solvedNodes) as DecisionTreeNode[]).filter(
      n => n.parentId === selectedNodeWithDetails.parentId && n.id !== selectedNodeWithDetails.id
    );
  }, [selectedNodeWithDetails, solvedNodes]);

  // Interactive core callbacks
  const handleUpdateNode = (id: string, updates: Partial<DecisionTreeNode>) => {
    updateScenariosWithHistory(prev => prev.map(sc => {
      if (sc.id !== currentScenarioId) return sc;
      const currentNodes = sc.tree.nodes;
      const current = currentNodes[id];
      if (!current) return sc;

      const updated = { ...current, ...updates };
      return {
        ...sc,
        tree: {
          ...sc.tree,
          nodes: { ...currentNodes, [id]: updated }
        }
      };
    }));
  };

  const handleUpdateNodes = (updates: Record<string, Partial<DecisionTreeNode>>) => {
    updateScenariosWithHistory(prev => prev.map(sc => {
      if (sc.id !== currentScenarioId) return sc;
      const currentNodes = { ...sc.tree.nodes };
      let changed = false;
      Object.entries(updates).forEach(([id, u]) => {
        if (currentNodes[id]) {
          currentNodes[id] = { ...currentNodes[id], ...u };
          changed = true;
        }
      });
      if (!changed) return sc;
      return {
        ...sc,
        tree: {
          ...sc.tree,
          nodes: currentNodes
        }
      };
    }));
  };

  const handleAddChild = (parentId: string, type: NodeType) => {
    updateScenariosWithHistory(prev => prev.map(sc => {
      if (sc.id !== currentScenarioId) return sc;
      const timestamp = Date.now();
      const newId = `${type.toLowerCase()}_${timestamp}`;
      
      const nodeLabels: Record<NodeType, string> = {
        DECISION: '新策略分支',
        CHANCE: '可能状态',
        TERMINAL: '追加结局点'
      };

      const defaultProb = type === 'CHANCE' ? 0.5 : undefined;
      const defaultPayoff = type === 'TERMINAL' ? 600 : undefined;

      const newChild: DecisionTreeNode = {
        id: newId,
        name: nodeLabels[type],
        type,
        parentId,
        probability: defaultProb,
        payoff: defaultPayoff,
        cost: 0
      };

      return {
        ...sc,
        tree: {
          ...sc.tree,
          nodes: {
            ...sc.tree.nodes,
            [newId]: newChild
          }
        }
      };
    }));
  };

  const handleDeleteNode = (id: string) => {
    if (id === currentScenario.tree.rootId) return; // protect root

    updateScenariosWithHistory(prev => prev.map(sc => {
      if (sc.id !== currentScenarioId) return sc;
      const nodesCopy = { ...sc.tree.nodes };

      // Recursively gather all descendants
      const collectDescendants = (pId: string, toDel: Set<string>) => {
        (Object.values(nodesCopy) as DecisionTreeNode[]).forEach(n => {
          if (n.parentId === pId) {
            toDel.add(n.id);
            collectDescendants(n.id, toDel);
          }
        });
      };

      const setDelete = new Set<string>([id]);
      collectDescendants(id, setDelete);

      setDelete.forEach(idDel => {
        delete nodesCopy[idDel];
      });

      return {
        ...sc,
        tree: {
          ...sc.tree,
          nodes: nodesCopy
        }
      };
    }));

    setSelectedNodeId(null);
  };

  const handleCloneBranch = (nodeId: string) => {
    updateScenariosWithHistory(prev => prev.map(sc => {
      if (sc.id !== currentScenarioId) return sc;
      const nodes = sc.tree.nodes;
      const targetNode = nodes[nodeId];
      if (!targetNode) return sc;

      const newNodes = { ...nodes };
      const timestamp = Date.now();
      let idCounter = 0;

      // Recursive helper to clone a node and its children
      const cloneSubtree = (originalId: string, parentId?: string): string => {
        const origNode = nodes[originalId];
        if (!origNode) return '';

        idCounter++;
        const newId = `${origNode.type.toLowerCase()}_clone_${timestamp}_${idCounter}`;
        
        const clonedNode: DecisionTreeNode = {
          ...origNode,
          id: newId,
          name: parentId ? origNode.name : `${origNode.name} (复制)`,
          parentId: parentId
        };

        newNodes[newId] = clonedNode;

        // Find children of this node
        const children = Object.values(nodes).filter(n => n.parentId === originalId);
        children.forEach(child => {
          cloneSubtree(child.id, newId);
        });

        return newId;
      };

      // Clone starting from targetNode, using targetNode.parentId as parent of cloned subtree root
      const newRootId = cloneSubtree(nodeId, targetNode.parentId);

      return {
        ...sc,
        tree: {
          ...sc.tree,
          nodes: newNodes
        }
      };
    }));
  };

  const handleCloneNewScenario = (name: string) => {
    const newId = `scenario-cloned-${Date.now()}`;
    const newScenario: Scenario = {
      id: newId,
      name,
      description: `基于 ${currentScenario.name} 派生出的沙卡分支。`,
      version: 'v1.0',
      tree: JSON.parse(JSON.stringify(currentScenario.tree))
    };

    updateScenariosWithHistory(prev => [...prev, newScenario]);
    setCurrentScenarioId(newId);
  };

  const handleAddBlankScenario = () => {
    const newId = `scenario-blank-${Date.now()}`;
    const blankScenario: Scenario = {
      id: newId,
      name: `空沙箱方案 - ${scenarios.length + 1}`,
      description: '轻量型运筹自建看板。请使用底部的控制器加子分支进行动态拓扑自建。',
      version: 'v1.0',
      tree: {
        id: `tree-blank-${Date.now()}`,
        name: '空沙箱方案',
        description: '自主构建决策大盘。',
        rootId: 'root',
        nodes: {
          'root': {
            id: 'root',
            name: '初始决策点',
            type: 'DECISION'
          }
        }
      }
    };

    updateScenariosWithHistory(prev => [...prev, blankScenario]);
    setCurrentScenarioId(newId);
    setSelectedNodeId('root');
  };

  const handleDeleteScenario = (id: string) => {
    let nextScenarioId = currentScenarioId;
    if (currentScenarioId === id) {
      const currentIndex = scenarios.findIndex(sc => sc.id === id);
      const remaining = scenarios.filter(sc => sc.id !== id);
      if (remaining.length > 0) {
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        nextScenarioId = remaining[nextIndex].id;
      } else {
        nextScenarioId = '';
      }
    }

    updateScenariosWithHistory(prev => {
      const filtered = prev.filter(sc => sc.id !== id);
      if (filtered.length === 0) {
        const newId = `scenario-blank-${Date.now()}`;
        const blankScenario: Scenario = {
          id: newId,
          name: '新空白建模沙箱',
          description: '轻量型运筹自建看板。请使用底部的控制器加子分支进行动态拓扑自建。',
          version: 'v1.0',
          tree: {
            id: `tree-blank-${Date.now()}`,
            name: '新空白建模沙箱',
            description: '自主构建决策大盘。',
            rootId: 'root',
            nodes: {
              'root': {
                id: 'root',
                name: '初始决策点',
                type: 'DECISION'
              }
            }
          }
        };
        setCurrentScenarioId(newId);
        setSelectedNodeId('root');
        return [blankScenario];
      }

      if (currentScenarioId === id && nextScenarioId) {
        setCurrentScenarioId(nextScenarioId);
        setSelectedNodeId(null);
      }
      return filtered;
    });
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans leading-relaxed flex flex-col justify-between">
      
      {/* 🚀 1. APP NAVBAR HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center shadow-sm">
              <div className="w-3.5 h-3.5 border-2 border-white rotate-45"></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2">
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                    OR-Tree <span className="text-slate-400 font-normal ml-1">决策建模与优化系统</span>
                  </h1>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                    v2.4-Pro
                  </span>
                </div>
                
                {/* 3个精炼设计切片 (Pill Chips) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="chip-python"
                    onClick={() => {
                      setActiveModal('python');
                      setPyLogs([]);
                      setPyCopied(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 hover:border-emerald-400 text-xs md:text-[12.5px] font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-2xs hover:shadow-xs"
                    title="生成并仿真运行对应的 Python 运筹决策算法代码"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Python 算力仿真</span>
                  </button>

                  <button
                    id="chip-optimize"
                    onClick={() => {
                      document.getElementById('auto-optimizer-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 hover:border-indigo-400 text-xs md:text-[12.5px] font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-2xs hover:shadow-xs"
                    title="滑动至决策优化器进行逆推参数求解"
                  >
                    <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>EMV 智能优化</span>
                  </button>

                  <button
                    id="chip-knowledge"
                    onClick={() => setActiveModal('knowledge')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 hover:border-amber-400 text-xs md:text-[12.5px] font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-2xs hover:shadow-xs"
                    title="查看期望货币价值理财模型与逆向归纳算法知识库"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>运筹决策课堂</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                基于期望货币价值 (EMV) 逆向归纳与风险剖面分析的极简商业推演终端
              </p>
            </div>
          </div>

          {/* Quick Sandbox Controls */}
          <div className="flex items-center gap-3">
            <button
              id="btn-create-blank-sandbox"
              onClick={handleAddBlankScenario}
              className="py-1.5 px-4 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all select-none cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>新增空白建模沙箱</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-slate-600 font-medium font-sans">云端计算已就绪</span>
            </div>
          </div>
        </div>
      </header>

      {/* 📁 2. VERSION SWITCHING HEADER TABS */}
      <section className="bg-white border-b border-slate-200 px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none py-1">
            <span className="text-[10.5px] text-slate-400 shrink-0 uppercase tracking-widest font-bold mr-1">
              决策场景方案
            </span>
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium items-center gap-1.5 overflow-x-auto">
              {scenarios.map(sc => {
                const isActive = sc.id === currentScenarioId;
                return (
                  <div
                    key={sc.id}
                    className={`flex items-center gap-1 rounded-md transition-all ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-100 font-semibold'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                    }`}
                  >
                    <button
                      id={`scenario-tab-${sc.id}`}
                      onClick={() => {
                        setCurrentScenarioId(sc.id);
                        setSelectedNodeId(null);
                      }}
                      className="px-3.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer focus:outline-none"
                    >
                      {sc.name}
                    </button>
                    {scenarios.length > 1 && (
                      pendingDeleteId === sc.id ? (
                        <div className="flex items-center gap-1 bg-red-50 text-red-600 rounded-md px-1.5 py-1 mr-1.5 border border-red-200 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScenario(sc.id);
                              setPendingDeleteId(null);
                            }}
                            className="text-[10px] font-bold hover:underline cursor-pointer px-1 text-red-700"
                          >
                            确认
                          </button>
                          <span className="text-[10px] text-red-300">|</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteId(null);
                            }}
                            className="text-slate-400 hover:text-slate-600 font-bold text-[10px] cursor-pointer px-1"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(sc.id);
                          }}
                          className="pr-2.5 pl-0.5 py-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer flex items-center justify-center"
                          title="删除该建模沙箱"
                        >
                          <X className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <span className="text-[10px] text-slate-400 font-mono shrink-0 hidden md:block">
            异步时钟同步已就绪
          </span>
        </div>
      </section>

      {/* 🧱 3. MAIN BENTO CONTAINER BODY */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
        
        {/* Scenario description alert box */}
        <div className="bg-indigo-600 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-100 font-bold text-xs uppercase tracking-widest">
              <Compass className="w-4 h-4 fill-indigo-500/10" />
              <span>推演策略目标陈述 / 当前结论</span>
            </div>
            <p className="text-sm text-indigo-50 leading-relaxed font-sans font-medium">
              {currentScenario.description}
            </p>
          </div>
          <div className="text-[11px] font-bold text-indigo-200 border border-indigo-500/50 bg-indigo-700/40 p-3 rounded-lg shrink-0 font-mono">
            🏆 方案级预期 EMV 均值
            <span className="text-white block text-xl font-extrabold mt-0.5">
              ¥{(solvedNodes[currentScenario.tree.rootId]?.emv ?? 0)} 万元
            </span>
          </div>
        </div>

        {/* Dynamic Canvas + Control Panel Column Arrangement */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* SIDEBAR BLOCK: (Left col, takes 4 columns) */}
          <div className="lg:col-span-4 flex flex-col">
            <NodeEditor
              selectedNode={selectedNodeWithDetails}
              parentNode={parentNode}
              siblingProbsCount={nodeSiblings.length}
              siblings={nodeSiblings}
              onUpdateNode={handleUpdateNode}
              onUpdateNodes={handleUpdateNodes}
              onAddChild={handleAddChild}
              onDeleteNode={handleDeleteNode}
            />
          </div>

          {/* MAIN GRAPH CANVAS BLOCK: (Right col, takes 8 columns) */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            <TopologyCanvas
              tree={currentScenario.tree}
              solvedNodes={solvedNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onUpdateNode={handleUpdateNode}
              onUpdateNodes={handleUpdateNodes}
              onDeleteNode={handleDeleteNode}
              onCloneBranch={handleCloneBranch}
            />
          </div>

        </div>

        {/* 🏆 4. MIDDLE SECTION: STORYTELLING SLIDES AND AI CONSULTANT */}
        <InsightsDashboard
          tree={currentScenario.tree}
          solvedNodes={solvedNodes}
          onHighlightNode={(id) => {
            if (id) {
              setSelectedNodeId(id);
            }
          }}
        />

        {/* 🤖 AUTOMATIC EMV OPTIMIZER */}
        <AutoOptimizer
          currentScenario={currentScenario}
          onUpdateScenarioTree={(updatedTree) => {
            updateScenariosWithHistory(prev => prev.map(sc => {
              if (sc.id === currentScenarioId) {
                return {
                  ...sc,
                  tree: updatedTree
                };
              }
              return sc;
            }));
          }}
          onCloneNewScenario={(name, tree) => {
            const newId = `scenario-optimized-${Date.now()}`;
            const newScenario: Scenario = {
              id: newId,
              name,
              description: `基于目标优化值进行智能动态参数求解而派生出的优化路线。`,
              version: 'v1.1-Opt',
              tree
            };
            updateScenariosWithHistory(prev => [...prev, newScenario]);
            setCurrentScenarioId(newId);
            setSelectedNodeId(null);
          }}
        />

        {/* 📉 5. MIDDLE SECTION: SENSITIVITY AND RISK CDF CHARTS */}
        <AnalyticsCharts
          tree={currentScenario.tree}
        />

        {/* 🗄️ 6. LOWER SECTION: SCENARIO DIFFERENCES DIFF & TEAM COLLAB */}
        <ScenarioDiff
          currentScenario={currentScenario}
          scenariosList={scenarios}
          onLoadScenario={(sc) => {
            setCurrentScenarioId(sc.id);
            setSelectedNodeId(null);
          }}
          onCloneScenario={handleCloneNewScenario}
        />

      </main>

      {/* <footer> Professional standard footer keeping it extremely tidy */}
      <footer className="bg-white text-slate-400 text-[11px] px-6 py-4 border-t border-slate-200 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-slate-500 font-medium">© 2026 OR-Tree 决策树计算工程部门。支持期望折现与多因子敏感性分析。</p>
          <div className="flex gap-4">
            <span>逆向归纳计算引擎: 毫秒级在线计算</span>
            <span className="font-semibold text-slate-500">版本: 2.4.0-Pro</span>
          </div>
        </div>
      </footer>

      {/* 🚀 MODAL OVERLAYS */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          {/* Python Calculation Modal */}
          {activeModal === 'python' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col transform transition-all duration-300">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Python 决策树逆向归纳计算仿真</h3>
                    <p className="text-[10px] text-slate-400">一键生成并仿真执行基于期望货币价值的后向诱导算法脚本</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <p className="text-xs text-slate-500 leading-relaxed">
                  本模块为你自动整合了当前决策树模型参数矩阵。生成的 Python 代码是完全符合运筹学规范的递归回溯程序，你可以一键复制到你的本地 Python 脚本中完美运行。
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: Code Block */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🐍 solver_script.py</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pythonCode);
                          setPyCopied(true);
                          setTimeout(() => setPyCopied(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-800 font-semibold cursor-pointer transition-all active:scale-95"
                      >
                        {pyCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{pyCopied ? '已复制源码！' : '复制 Python 代码'}</span>
                      </button>
                    </div>
                    <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] leading-relaxed overflow-auto h-[280px] border border-slate-800 shadow-inner">
                      {pythonCode}
                    </pre>
                  </div>

                  {/* Right: Math Compiler Logs Simulator */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">💻 计算终端 (Terminal)</span>
                      <button
                        onClick={handleRunPySimulation}
                        disabled={pySimulating}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white disabled:text-slate-400 px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
                      >
                        <Play className="w-3 h-3 fill-white text-white shrink-0" />
                        <span>{pySimulating ? '计算正在进行...' : '运行算力仿真'}</span>
                      </button>
                    </div>
                    <div className="p-4 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[10.5px] leading-relaxed h-[280px] border border-slate-900 shadow-inner overflow-y-auto space-y-2">
                      <div className="text-[10px] text-slate-500 border-b border-slate-850 pb-1.5 mb-2 flex items-center justify-between">
                        <span>OR-Tree Solver Console v1.0</span>
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      </div>
                      {pyLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-600">
                          <Terminal className="w-6 h-6 text-slate-700 mb-1.5" />
                          <span className="text-[10px]">点击右上角【运行算力仿真】</span>
                          <span className="text-[9px]">将在控制台模拟执行 Backward Induction 求解流</span>
                        </div>
                      ) : (
                        pyLogs.map((log, idx) => (
                          <div key={idx} className={`${
                            log.includes('Success') || log.includes('🎯') 
                              ? 'text-emerald-300 font-bold bg-emerald-950/20 px-1 py-0.5 rounded border border-emerald-900/10' 
                              : log.startsWith('$') ? 'text-indigo-300' : 'text-slate-350'
                          }`}>
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Educational Knowledge Guide Modal */}
          {activeModal === 'knowledge' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col transform transition-all duration-300">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">运筹决策分析极速课堂 (知识导引)</h3>
                    <p className="text-[10px] text-slate-400">掌握期望货币价值、逆向归纳计算与商业运筹评估基础</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1 leading-relaxed text-xs text-slate-600">
                
                {/* Math Section */}
                <div className="space-y-2 bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Cpu className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>核心数理规则：期望货币价值 (Expected Monetary Value)</span>
                  </h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    在不确定性商业环境下，每一个不可控事件分支（机会点）的分支权重通常由客观概率 <strong>P_i</strong> 控制。
                    期望货币价值表示将各项可能的发生概率与其对应的绝对收益相乘后的平均趋势值：
                  </p>
                  <div className="py-2.5 px-3 bg-white border border-amber-150/70 rounded-lg text-center font-mono text-slate-800 text-xs font-bold leading-none select-all shadow-inner my-2">
                    EMV_Node = Σ ( Probability_i × ( EMV_Child_i - Cost_Child_i ) )
                  </div>
                  <p className="text-[10.5px] text-slate-500">
                    <strong>逆向归纳算法 (Backward Induction)</strong> 是典型的动态规划机制，自右向左（从项目终点叶子节点向左逆推）计算。在机会点执行乘加运算，在决策点选择最大化收益的路径直接吸收。
                  </p>
                </div>

                {/* Legend Table Section */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">📂 建模拓扑图元释义</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border border-slate-150 rounded-xl p-3 bg-slate-50/40 text-center space-y-1 hover:border-slate-300 transition-all">
                      <div className="w-7 h-7 bg-indigo-50 text-indigo-700 font-bold rounded-lg flex items-center justify-center mx-auto text-xs shadow-3xs border border-indigo-100">■</div>
                      <strong className="text-slate-700 block text-[11px] font-bold">决策节点 (Decision)</strong>
                      <span className="text-[10px] text-slate-400 leading-normal block">策略或抉择的产生枢纽。其子分支不具有概率，系统会自动选取 EMV 最高的支线。</span>
                    </div>
                    <div className="border border-slate-150 rounded-xl p-3 bg-slate-50/40 text-center space-y-1 hover:border-slate-300 transition-all">
                      <div className="w-7 h-7 bg-emerald-50 text-emerald-700 font-bold rounded-full flex items-center justify-center mx-auto text-xs shadow-3xs border border-emerald-100">●</div>
                      <strong className="text-slate-700 block text-[11px] font-bold">机会点 (Chance)</strong>
                      <span className="text-[10px] text-slate-400 leading-normal block">外部突发。子节点均带有独立的百分几率 P，系统计算时作加权期望EMV汇流。</span>
                    </div>
                    <div className="border border-slate-150 rounded-xl p-3 bg-slate-50/40 text-center space-y-1 hover:border-slate-300 transition-all">
                      <div className="w-7 h-7 bg-rose-50 text-rose-700 font-extrabold rounded-none rotate-45 flex items-center justify-center mx-auto text-[10px] shadow-3xs border border-rose-100"><span className="-rotate-45 block shrink-0 font-sans">▲</span></div>
                      <strong className="text-slate-700 block text-[11px] font-bold">结局终点 (Terminal)</strong>
                      <span className="text-[10px] text-slate-400 leading-normal block">流推演折旧兑现终局。携带有绝对经济净值指标，作为逆向推算的算力源泉点。</span>
                    </div>
                  </div>
                </div>

                {/* Classic Rules Section */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs">📋 替代型商业决策学派</h4>
                  <div className="border border-slate-150 rounded-xl overflow-hidden shadow-3xs">
                    <table className="w-full text-left text-[10.5px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold text-[10px]">
                          <th className="p-2 pl-3">法则名称 (Criterion)</th>
                          <th className="p-2">决策者心里预期 (Mindset)</th>
                          <th className="p-2 pr-3">适用经典商业案例 (Scenario)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-150/50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-2 pl-3 font-semibold text-slate-700">Maximax 乐观法则</td>
                          <td className="p-2">大中取大：只考虑各大抉择下最完美爆单的暴利结局。</td>
                          <td className="p-2 pr-3 text-slate-400">天使投资、极早期创新赛道开拓</td>
                        </tr>
                        <tr className="border-b border-slate-150/50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-2 pl-3 font-semibold text-slate-700">Maximin 悲观法则</td>
                          <td className="p-2">大中取小：在最恶劣危机状态下最大程度锁死项目兜底损失。</td>
                          <td className="p-2 pr-3 text-slate-400">医疗安全等级评估、极端防御战略配置</td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-2 pl-3 font-semibold text-slate-700">Minimax Regret 遗憾最小化</td>
                          <td className="p-2">悔恨控制：评估错失抉择产生最大“机会损害”值作对冲。</td>
                          <td className="p-2 pr-3 text-slate-400">中等弹性消费电子供应链投模测算</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
