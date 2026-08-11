import React, { useMemo } from 'react';
import { AreaChart, ShieldAlert } from 'lucide-react';
import { DecisionTree, DecisionTreeNode } from '../types';
import { getRiskProfile } from '../treeEngine';

interface AnalyticsChartsProps {
  tree: DecisionTree;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ tree }) => {
  // Find root options to compute risk profile dynamically
  const rootChildren = useMemo(() => {
    return (Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.parentId === tree.rootId);
  }, [tree]);

  const optionA = rootChildren[0];
  const optionB = rootChildren[1];

  // ==========================================
  // RISK PROFILE (PMF & CDF) CALCULATIONS
  // ==========================================
  const riskProfiles = useMemo(() => {
    if (!optionA || !optionB) return null;
    const profileA = getRiskProfile(tree, optionA.id);
    const profileB = getRiskProfile(tree, optionB.id);
    return {
      profileA,
      profileB
    };
  }, [tree, optionA, optionB]);

  // Find worst case drawdown risks
  const riskMetrics = useMemo(() => {
    if (!riskProfiles) return null;
    const pmfA = riskProfiles.profileA.pmf;
    const pmfB = riskProfiles.profileB.pmf;

    // Filter negative payoffs representing loss
    const lossProbA = pmfA.filter(p => p.payoff < 0).reduce((sum, curr) => sum + curr.probability, 0);
    const lossProbB = pmfB.filter(p => p.payoff < 0).reduce((sum, curr) => sum + curr.probability, 0);

    const minPayoffA = pmfA.length > 0 ? pmfA[0].payoff : 0;
    const minPayoffB = pmfB.length > 0 ? pmfB[0].payoff : 0;

    return {
      lossProbA: Math.round(lossProbA * 100),
      lossProbB: Math.round(lossProbB * 100),
      minPayoffA,
      minPayoffB
    };
  }, [riskProfiles]);

  return (
    <div id="analytics-panel" className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      
      {/* Header Title */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <AreaChart className="w-4 h-4 text-indigo-600" />
        <h3 className="text-xs font-bold text-slate-800">风险剖面分布 (CDF/PMF)</h3>
      </div>

      {/* ==================== RISK PROFILE CONTENT ==================== */}
      {riskProfiles && (
        <div id="risk-tab-content" className="space-y-5 text-xs">
          <div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              多维度刻画决策的“下行边界”与“极端暴雷概率”，防止盲目信任 EMV 平均期望而忽视企业现金流断裂风险。
            </p>
          </div>

          {/* CDF Steps simulation in SVG */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-500">🏆 累积概率分布曲线 (CDF - 越偏右代表下行保障越优)：</span>
            
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 h-[150px] relative">
              {/* Draw step CDF SVG curves */}
              <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none">
                
                {/* Horizontal reference lines */}
                <line x1="0" y1="50" x2="300" y2="50" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="2,2"/>
                <line x1="0" y1="10" x2="300" y2="10" stroke="#fee2e2" strokeWidth="1"/>

                {/* Draw X=0 vertical axes */}
                <line x1="100" y1="0" x2="100" y2="100" stroke="#94a3b8" strokeWidth="1"/>

                {/* Option A (R&D) CDF curve in Orange */}
                <path
                  d="M 10 95 L 40 95 L 40 70 L 120 70 L 120 30 L 220 30 L 220 5 L 290 5"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="1"
                />

                {/* Option B (Licensing) CDF curve in Blue */}
                <path
                  d="M 10 95 L 100 95 L 100 65 L 180 65 L 250 5 L 290 5"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                />
              </svg>

              {/* Labels on plots */}
              <span className="absolute left-2 top-2 text-[8px] text-red-500 font-bold scale-90">100% 累积</span>
              <span className="absolute right-2 bottom-2 text-[8px] text-slate-400 scale-90">结局净收益➔</span>
              
              <div className="absolute top-4 right-4 text-[9px] bg-white border p-1.5 rounded-lg space-y-1 shadow-xs font-sans scale-90">
                <div className="flex items-center gap-1 text-[#ef4444]">
                  <span className="w-2 h-0.5 bg-[#ef4444] inline-block"/>
                  <span>自主研发 路径比对</span>
                </div>
                <div className="flex items-center gap-1 text-[#3b82f6]">
                  <span className="w-2 h-0.5 bg-[#3b82f6] inline-block"/>
                  <span>购买授权 路径比对</span>
                </div>
              </div>
            </div>
          </div>

          {/* Underway Key Risk Indicators Panel */}
          {riskMetrics && (
            <div className="grid grid-cols-2 gap-4">
              {/* Option A parameters */}
              <div className="bg-red-50/10 border border-red-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-red-700 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>自主独立研发 风险暴露</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-600 font-sans">
                  <div>• 亏损发生概率：<span className="text-red-600 font-bold font-mono">{riskMetrics.lossProbA}%</span></div>
                  <div>• 极端不利结局：<span className="text-red-600 font-bold font-mono">¥ {riskMetrics.minPayoffA} 万元</span></div>
                  <div>• 风险韧性特征：高风险、高天花板，大宣发高爆款收益 ¥1550w。</div>
                </div>
              </div>

              {/* Option B parameters */}
              <div className="bg-blue-50/10 border border-blue-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>技术授权购买 风险暴露</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-600 font-sans">
                  <div>• 亏损发生概率：<span className="text-blue-600 font-bold font-mono">{riskMetrics.lossProbB}%</span></div>
                  <div>• 极端不利结局：<span className="text-blue-600 font-bold font-mono">¥ {riskMetrics.minPayoffB} 万元</span></div>
                  <div>• 风险韧性特征：有稳定清场保底机制，亏损概率明显更低。</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
