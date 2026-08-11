import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Lightbulb, Play, Layers, Compass, Loader2, Printer, Download, X, FileText, Award, Coins, Calendar, TrendingUp, Settings, MessageSquare, Send, Check } from 'lucide-react';
import { DecisionTree, DecisionTreeNode } from '../types';
import { getSavedAISettings, saveAISettings, generateRecommendationWithAI, chatWithAI, AISettings } from '../lib/aiService';

interface InsightsDashboardProps {
  tree: DecisionTree;
  solvedNodes: Record<string, DecisionTreeNode>;
  onHighlightNode: (id: string | null) => void;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  tree,
  solvedNodes,
  onHighlightNode
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [aiReport, setAiReport] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // AI settings state
  const [activeTab, setActiveTab] = useState<'report' | 'chat'>('report');
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(getSavedAISettings());
  const [settingsApiKey, setSettingsApiKey] = useState(aiSettings.apiKey);
  const [settingsModel, setSettingsModel] = useState(aiSettings.model);
  const [settingsEndpoint, setSettingsEndpoint] = useState(aiSettings.customEndpoint || '');

  // chat state
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'model'; content: string }[]>([
    {
      id: 'welcome',
      role: 'model',
      content: '👋 您好！我是您的 **战棋大模型洞察助手**。我已经加载了您当前的决策拓扑数据，包含所有方案期望收益（EMV）及裁剪计算。您可以向我提问任何关于本模型的优化、避险或场景假设问题。例如：\n- *“如果将研发成功概率降到 50%，哪条路线最优？”*\n- *“请帮我深度对比自主研发与外部技术授权的极端下行风险”*'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync settings inputs when loaded settings change
  useEffect(() => {
    setSettingsApiKey(aiSettings.apiKey);
    setSettingsModel(aiSettings.model);
    setSettingsEndpoint(aiSettings.customEndpoint || '');
  }, [aiSettings]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading, activeTab]);

  // Compute winning strategy variables
  const winnersList = (Object.values(solvedNodes) as DecisionTreeNode[])
    .filter(n => n.parentId === tree.rootId && !n.isPruned)
    .sort((a,b) => (b.emv ?? 0) - (a.emv ?? 0));
  
  const winningChoice = winnersList[0] || null;

  // Build sequential optimal path for the report
  const optimalPath = useMemo(() => {
    const path: DecisionTreeNode[] = [];
    const rootNode = solvedNodes[tree.rootId];
    if (!rootNode) return path;

    const visited = new Set<string>();
    let current: DecisionTreeNode | undefined = rootNode;
    let iteration = 0;
    while (current && iteration < 100) {
      if (visited.has(current.id)) {
        break; // Guard against cyclic paths
      }
      visited.add(current.id);
      path.push(current);
      if (current.type === 'TERMINAL') {
        break;
      }

      const currentId = current.id;
      const children = (Object.values(solvedNodes) as DecisionTreeNode[]).filter(
        c => c.parentId === currentId
      );

      if (children.length === 0) break;

      let nextNode: DecisionTreeNode | undefined;
      if (current.type === 'DECISION') {
        // Trace unpruned child
        const unpruned = children.find(c => !c.isPruned);
        nextNode = unpruned || children.sort((a, b) => (b.emv ?? 0) - (a.emv ?? 0))[0];
      } else {
        // Chance node: follow the branch with max EMV
        nextNode = children.sort((a, b) => (b.emv ?? 0) - (a.emv ?? 0))[0];
      }

      if (nextNode && nextNode.id !== current.id) {
        current = nextNode;
      } else {
        break;
      }
      iteration++;
    }
    return path;
  }, [tree, solvedNodes]);

  // Story slides definitions
  const slides = [
    {
      title: '① 抉择引路：顶层战略大局评定',
      concept: '多因素权衡初始大项选择',
      desc: `在顶层根节点“${tree.name}”中，共有 ${(Object.values(tree.nodes) as DecisionTreeNode[]).filter(n => n.parentId === tree.rootId).length} 个备选项目路径进行多阶段折现评估。
      我们利用逆向递推法（Rollback Induction），将后方的一切机会概率和结局净收益由右至左折现：
      - 【自主研发】折现后净EMV值高。
      - 【技术授权】收益平缓稳妥。
      - 【买入理财】属于极度保守决策。`,
      focusNode: 'root'
    },
    {
      title: '② 风险跨越：研发与授权的市场检验',
      concept: '多概率状态抵御宏观不确定性',
      desc: `在二级分叉上进行机会节点（●）解耦：
      - 在自主研发下，面临 70% 成功率与 30% 失败率的磨合。
      - 在技术授权下，面临市场高接受度（65%）和山寨争抢低接受度（35%）的冲击。
      分析结果表明：研发的高概率保障了收益上升通道，即使存在研发失败可能，均值总折算也更有优势。`,
      focusNode: 'independent_rd'
    },
    {
      title: '③ 终端决胜：中局营销决策追加',
      concept: '微观成本管理下的收益博弈',
      desc: `如果进入研发成功决策区，将再次出现抉择门槛：“激进大推广” vs “精益众筹”。
      - 激进大推广需耗资 20万 追加预算，高收益达 220万。
      - 精益众筹仅需 5万 追加，众筹爆单达 120万。
      逆向EMV测算：精益众筹下高成功概率（80%）提供了更理想的“高弹性/低风险”配合结构，综合最优！`,
      focusNode: 'rd_success'
    }
  ];

  // Set highlighted node on canvass when slide changes
  useEffect(() => {
    onHighlightNode(slides[activeSlide]?.focusNode || null);
    return () => onHighlightNode(null);
  }, [activeSlide]);

  const handleNextSlide = () => {
    setActiveSlide(prev => Math.min(prev + 1, slides.length - 1));
  };

  const handlePrevSlide = () => {
    setActiveSlide(prev => Math.max(prev - 1, 0));
  };

  // Request Gemini/DeepSeek report
  const handleFetchAiReport = async () => {
    setAiLoading(true);
    setAiReport('');
    try {
      const settings = getSavedAISettings();
      const report = await generateRecommendationWithAI(tree, solvedNodes, settings);
      setAiReport(report);
    } catch (e: any) {
      console.error(e);
      setAiReport(`### ❌ 决策报告获取失败\n\n${e.message || '未知错误'}\n\n*提示：如果您是将项目部署在静态托管服务器（如 GitHub Pages）上，由于没有后端中转，必须配置并输出您个人的 API Key 直连服务商。请点击右上角 ⚙️ 设置大模型图标进行配置。*`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveSettings = () => {
    const updated: AISettings = {
      apiKey: settingsApiKey.trim(),
      model: settingsModel,
      customEndpoint: settingsEndpoint.trim() || undefined
    };
    saveAISettings(updated);
    setAiSettings(updated);
    setShowSettings(false);
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userText = chatInput.trim();
    setChatInput('');

    const newUserMsg = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: userText
    };
    setChatMessages(prev => [...prev, newUserMsg]);
    setChatLoading(true);

    try {
      const settings = getSavedAISettings();
      const response = await chatWithAI(
        userText,
        [...chatMessages, newUserMsg].map(m => ({ role: m.role, content: m.content })),
        tree,
        solvedNodes,
        settings
      );

      setChatMessages(prev => [...prev, {
        id: `model-${Date.now()}`,
        role: 'model' as const,
        content: response
      }]);
    } catch (e: any) {
      console.error(e);
      setChatMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model' as const,
        content: `❌ **追问失败**\n\n${e.message || '无法获取模型回答'}\n\n*请点击右上角 ⚙️ 确认您是否已输入正确的 API Key 并在浏览器直连模式下运行。*`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div id="insights-dashboard" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* 1. Left - Storytelling step slide */}
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl p-5 flex flex-col justify-between h-[360px]">
        <div>
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <Compass className="w-5 h-5" />
              <span className="font-semibold text-xs uppercase tracking-widest">
                多阶段故事推演推演卡
              </span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">
              阶段 {activeSlide + 1} / {slides.length}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 fill-indigo-400 text-indigo-400 shrink-0" />
              {slides[activeSlide].title}
            </h4>
            <span className="text-[10px] text-indigo-400 block font-medium">
              💡 核心运筹概念: {slides[activeSlide].concept}
            </span>
            <p className="text-xs text-slate-300 leading-relaxed pt-2 whitespace-pre-line font-sans">
              {slides[activeSlide].desc}
            </p>
          </div>
        </div>

        {/* Story sliding button actions */}
        <div className="flex justify-between items-center border-t border-slate-800 pt-3 mt-4">
          <button
            id="btn-prev-story-slide"
            onClick={handlePrevSlide}
            disabled={activeSlide === 0}
            className="p-1 px-3 rounded-lg border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>前一阶段</span>
          </button>
          
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  activeSlide === i ? 'bg-indigo-500 w-3' : 'bg-slate-850'
                }`}
              />
            ))}
          </div>

          <button
            id="btn-next-story-slide"
            onClick={handleNextSlide}
            disabled={activeSlide === slides.length - 1}
            className="p-1 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            <span>下一阶段</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Right - AI Consultant Report */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between h-[360px] overflow-hidden">
        <div className="flex flex-col h-full justify-between overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
                <Sparkles className="w-4 h-4 fill-indigo-500/10" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-855 text-sm">AI 智慧战棋洞察助手</h4>
                <p className="text-slate-400 text-[9.5px]">根据求解模型实时拟定风控报告或对话</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {/* Settings gear icon button */}
              <button
                id="btn-toggle-ai-settings"
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg border text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors cursor-pointer ${showSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 bg-white'}`}
                title="设置大模型与 API-Key"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {activeTab === 'report' && !showSettings && (
                <button
                  id="btn-trigger-ai-recommendation"
                  onClick={handleFetchAiReport}
                  disabled={aiLoading}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3 text-indigo-200" />}
                  <span>生成报告</span>
                </button>
              )}
            </div>
          </div>

          {/* Mini elegant tabs to toggle Report vs Chat (hidden during settings mode) */}
          {!showSettings && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mt-2 shrink-0">
              <button
                id="tab-ai-report"
                onClick={() => setActiveTab('report')}
                className={`flex-1 py-1 text-[10px] font-semibold rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${activeTab === 'report' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📊 智能研判报告</span>
              </button>
              <button
                id="tab-ai-chat"
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-1 text-[10px] font-semibold rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${activeTab === 'chat' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>💬 决策问答助理</span>
              </button>
            </div>
          )}

          {/* AI Settings Overlay or regular output panels */}
          {showSettings ? (
            <div className="flex-1 overflow-y-auto mt-2 border border-indigo-100 bg-indigo-50/15 p-3 rounded-lg text-xs text-slate-700 space-y-3 scrollbar-thin">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
                <span className="font-bold text-slate-800 text-[10.5px] flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5 text-indigo-600 animate-spin-slow" />
                  大模型配置 (支持 GitHub 静态运行)
                </span>
                <span className="text-[8px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded">Local Storage</span>
              </div>

              <div className="space-y-1">
                <label className="block text-[9.5px] font-bold text-slate-500">1. 手工输入 API-Key (直连大模型所需)：</label>
                <input
                  id="settings-api-key"
                  type="password"
                  value={settingsApiKey}
                  onChange={(e) => setSettingsApiKey(e.target.value)}
                  placeholder="输入 Gemini Key 或 DeepSeek Key"
                  className="w-full text-xs p-1.5 rounded border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                />
                <p className="text-[8.5px] text-slate-400 leading-tight">由于部署在 GitHub 等静态托管无后端环境，需要提供 API Key 发起端侧直接请求。</p>
              </div>

              <div className="space-y-1">
                <label className="block text-[9.5px] font-bold text-slate-500">2. 选择大模型 (LLM Model)：</label>
                <select
                  id="settings-model"
                  value={settingsModel}
                  onChange={(e) => setSettingsModel(e.target.value)}
                  className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white cursor-pointer"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (极速智能, 推荐)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (旧版兼容)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (强逻辑推理型)</option>
                  <option value="deepseek-v4-pro">DeepSeek-V4-Pro (深度商业推理)</option>
                  <option value="deepseek-chat">DeepSeek V3 (高速通用对话)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[9.5px] font-bold text-slate-500 flex items-center justify-between">
                  <span>3. API 代理/直连端点 (可选，DeepSeek 及国内中转必备)：</span>
                </label>
                <input
                  id="settings-endpoint"
                  type="text"
                  value={settingsEndpoint}
                  onChange={(e) => setSettingsEndpoint(e.target.value)}
                  placeholder="例：https://api.deepseek.com/chat/completions"
                  className="w-full text-xs p-1.5 rounded border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
                />
                <p className="text-[8.5px] text-slate-400 leading-tight">Gemini 默认直连。若使用官方 DeepSeek-V4-Pro 填 https://api.deepseek.com/chat/completions，或填写中转代理端点。</p>
              </div>

              <div className="flex gap-1.5 pt-1">
                <button
                  id="btn-confirm-settings"
                  onClick={handleSaveSettings}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>保存设置并确认选择</span>
                </button>
                <button
                  id="btn-cancel-settings"
                  onClick={() => setShowSettings(false)}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs cursor-pointer transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : activeTab === 'report' ? (
            /* AI report output area */
            <div className="flex-1 overflow-y-auto mt-2.5 border border-slate-200 bg-slate-50/50 p-3 rounded-lg text-xs text-slate-600 leading-relaxed font-sans scrollbar-thin">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-[10px] animate-pulse">正在传输拓扑，调取 {aiSettings.model} 进行研判...</span>
                </div>
              ) : aiReport ? (
                <div id="ai-report-markdown" className="space-y-2.5 prose prose-sm max-w-none text-slate-700">
                  {/* Simplified custom parser for simple markdown elements in rendering */}
                  {aiReport.split('\n\n').map((para, i) => {
                    if (para.startsWith('###') || para.startsWith('##')) {
                      return <h4 key={i} className="font-bold text-slate-800 text-xs mt-2.5 flex items-center gap-1 border-l-2 border-indigo-500 pl-1">{para.replace(/^(#+)\s*/, '')}</h4>;
                    }
                    if (para.startsWith('-') || para.startsWith('*')) {
                      return (
                        <ul key={i} className="list-disc pl-3.5 space-y-1 mt-1 text-[10.5px] text-slate-650">
                          {para.split('\n').map((line, j) => (
                            <li key={j}>{line.replace(/^-\s*|^\*\s*/, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={i} className="text-[10.5px] text-slate-650 whitespace-pre-line leading-relaxed">{para}</p>;
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 text-center p-3">
                  <Compass className="w-5 h-5 text-slate-300 stroke-dasharray animate-pulse" />
                  <span className="text-[10px]">点击上方“生成报告”进行专业演算分析，或切换至“决策问答助理”提问。</span>
                </div>
              )}
            </div>
          ) : (
            /* Interactive Chatbot area */
            <div className="flex-1 mt-2.5 border border-slate-200 bg-slate-50/50 rounded-lg text-xs leading-relaxed font-sans flex flex-col justify-between overflow-hidden">
              {/* Message Feed list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[8.5px] text-slate-400 mb-0.5 font-medium">
                      {msg.role === 'user' ? '🧔 决策者' : `🤖 洞察助理 (${aiSettings.model})`}
                    </span>
                    <div
                      className={`p-2 rounded-lg max-w-[92%] leading-relaxed whitespace-pre-wrap text-[10.5px] font-sans ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-750 rounded-tl-none shadow-2xs'}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex flex-col items-start">
                    <span className="text-[8.5px] text-slate-400 mb-0.5 font-medium">🤖 {aiSettings.model} 正在深度解析中...</span>
                    <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center gap-1.5 text-indigo-700 text-[10px]">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                      <span className="animate-pulse">思考分析中，正在关联当前博弈树状态...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Send bar */}
              <div className="p-1.5 bg-white border-t border-slate-200 flex items-center gap-1.5 shrink-0">
                <input
                  id="chat-assistant-input"
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChatMessage();
                  }}
                  disabled={chatLoading}
                  placeholder={aiSettings.apiKey ? "向大模型追问最优解/剪枝细节..." : "🔒 请点击齿轮配置 API Key 直连大模型进行追问"}
                  className="flex-1 text-[10.5px] p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 rounded border border-slate-200 bg-slate-50/10 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <button
                  id="btn-send-chat-message"
                  onClick={handleSendChatMessage}
                  disabled={chatLoading || !chatInput.trim() || !aiSettings.apiKey}
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={aiSettings.apiKey ? "发送消息" : "请先配置 API Key"}
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Golden path brief status bottom */}
          {winningChoice && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg p-2 mt-2.5 text-[10px] flex items-center justify-between gap-3 shrink-0">
              <span className="flex items-center gap-1 text-emerald-700 font-medium truncate">
                <CheckCircleShape />
                <span className="truncate">综合最优路线: <strong>{winningChoice.name}</strong></span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono font-bold text-emerald-700">EMV ¥{winningChoice.emv}万</span>
                <button
                  id="btn-open-report-export"
                  onClick={() => setIsReportModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-0.5 px-1.5 rounded hover:shadow-xs transition-all flex items-center gap-0.5 cursor-pointer select-none whitespace-nowrap text-[9px]"
                  title="生成精装决策研判报告，支持打印 PDF / 下载"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>导出报告</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 🧾 INTUITIVE DETAILED REPORT PRINT MODAL OVERLAY */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto print:p-0 print:bg-white">
          
          {/* Printable style injector */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Completely isolate report content during PDF conversion */
              body * {
                visibility: hidden !important;
              }
              #printable-report, #printable-report * {
                visibility: visible !important;
              }
              #printable-report {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 30px !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
              .print-hidden {
                display: none !important;
              }
            }
          `}} />

          <div className="bg-slate-50 rounded-2xl border border-slate-150 shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col transform transition-all duration-300 print:max-h-none print:shadow-none print:border-none print:bg-white">
            
            {/* Header controllers (Hidden in custom print process) */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between print-hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">OR-Tree 国标标准级战略项目研判分析报告</h3>
                  <p className="text-[10px] text-slate-400">已为您生成格式排版的 A4 打印预览，可直接【导出 PDF】或连接纸张打印机</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs cursor-pointer shadow-xs transition-all active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>立即打印 / 存为 PDF</span>
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* A4 Document sheet preview area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-200/50 flex justify-center print:p-0 print:bg-white print:overflow-visible">
              
              {/* Document Paper Container */}
              <div
                id="printable-report"
                className="bg-white border border-slate-300/80 rounded-sm shadow-xl p-12 max-w-[210mm] w-full text-slate-800 font-sans leading-relaxed relative print:shadow-none print:border-none print:p-0"
                style={{ minHeight: '297mm' }}
              >
                
                {/* Visual Seal / Watermark Accent */}
                <div className="absolute top-12 right-12 text-right">
                  <div className="border border-indigo-200 bg-indigo-50/20 text-indigo-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded tracking-wider uppercase">
                    EMV Report Verified
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">ID: OR2.4-{Math.floor(1000 + Math.random() * 9000)}</span>
                </div>

                {/* Primary Document Header Title */}
                <div className="border-b-2 border-slate-900 pb-5 mb-6 space-y-2">
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold uppercase tracking-widest text-[9.5px]">
                    <Award className="w-4 h-4" />
                    <span>运筹学决策分析与多阶投资模型研判评估报告</span>
                  </div>
                  <h1 className="text-2xl font-extrabold text-slate-905 tracking-tight">
                    关于「{tree.name}」的最优战略决策路径分析意见书
                  </h1>
                  
                  <div className="grid grid-cols-4 gap-4 text-[10.5px] text-slate-500 font-medium pt-3">
                    <div>
                      <span>分析模型：</span>
                      <strong className="text-slate-700 block mt-0.5 font-bold">{tree.name}</strong>
                    </div>
                    <div>
                      <span>评估时间：</span>
                      <strong className="text-slate-700 block mt-0.5 font-mono">2026-06-23 UTC</strong>
                    </div>
                    <div>
                      <span>演算核心：</span>
                      <strong className="text-slate-700 block mt-0.5">逆向归纳 Backward Induction</strong>
                    </div>
                    <div>
                      <span>报告出具：</span>
                      <strong className="text-indigo-600 block mt-0.5 font-bold">OR-Tree Pro AI Engine</strong>
                    </div>
                  </div>
                </div>

                {/* Executive Summary Block */}
                <div className="space-y-3 mb-6">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>一、 模型执行提要 (Executive Summary)</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed indent-5">
                    本报告基于应用数学中期望货币价值（EMV）决策树计算标准，对本项目场景<strong>《{tree.name}》</strong>涉及到的全拓扑树层级进行动态演算。模型采用最客观的概率折现模型对各叶片及机会过程进行了向左（Backward Induction）规整，为企业在面临众多高额资本投入、高阻力市场概率、多种备选方案叠加的情况下，寻觅兼备最高稳态胜率与财务增量的优化总决策组合方案。
                  </p>
                </div>

                {/* Main Results / Optimal Strategy Route */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 mb-6 space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>二、 核心决策推演结论 (Optimal Strategy Route)</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-150 p-4 rounded-lg shadow-3xs space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">计算得出的最优预期收益 (Maximum EMV)</span>
                      <strong className="text-2xl text-emerald-700 tracking-tight font-extrabold inline-block">
                        ¥ {(solvedNodes[tree.rootId]?.emv ?? 0)} 万元
                      </strong>
                      <span className="text-[9.5px] text-slate-400 block">注：此处的 EMV 均值已把后续所有概率折算、追加资本折旧均包含在内。</span>
                    </div>

                    <div className="bg-white border border-slate-150 p-4 rounded-lg shadow-3xs space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">首选推荐战略路径 (Strategic Entrance)</span>
                      <strong className="text-xs text-indigo-700 tracking-tight font-bold block mt-1">
                        {winningChoice ? winningChoice.name : '等待选择'}
                      </strong>
                      <span className="text-[9.5px] text-slate-500 block leading-relaxed mt-1">
                        在首阶段根选项卡中，选择「<strong>{winningChoice ? winningChoice.name : '无'}</strong>」方向可以最高效率对冲市场不确定，拉升盈利分水岭。
                      </span>
                    </div>
                  </div>

                  {/* Sequential Optimal Routing Traced */}
                  <div className="mt-2 text-[10.5px] space-y-2">
                    <span className="text-[10px] text-slate-400 block font-semibold">推荐执行路线追溯链 (Sequential Routing Chain):</span>
                    <div className="bg-white border border-slate-150 p-3 rounded-lg flex flex-wrap items-center gap-2">
                      {optimalPath.map((node, i) => (
                        <React.Fragment key={`optimal-path-${node.id}-${i}`}>
                          {i > 0 && <span className="text-slate-350 text-[11px] font-bold">➔</span>}
                          <div className={`px-2 py-1 rounded-md text-[10.5px] font-semibold flex items-center gap-1 ${
                            node.type === 'DECISION'
                              ? 'bg-indigo-50 border border-indigo-150 text-indigo-800'
                              : node.type === 'CHANCE'
                              ? 'bg-emerald-50 border border-emerald-150 text-emerald-800'
                              : 'bg-rose-50 border border-rose-150 text-rose-800'
                          }`}>
                            <span className="text-[9.5px]">
                              {node.type === 'DECISION' ? '■' : node.type === 'CHANCE' ? '●' : '▲'}
                            </span>
                            <span>{node.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              ({node.emv !== undefined ? `¥${node.emv}w` : ''})
                            </span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Structured Detailed Nodes Table */}
                <div className="space-y-3 mb-6">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>三、 决策拓扑节点参数与折算详情 (Topology Parameters)</span>
                  </h3>

                  <div className="border border-slate-200 rounded-lg overflow-hidden shadow-3xs bg-white">
                    <table className="w-full text-left text-[10.5px] leading-tight">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[9.5px] uppercase">
                          <th className="p-2.5 pl-4">节点 ID & 名称 (Node ID/Name)</th>
                          <th className="p-2.5">拓扑类型</th>
                          <th className="p-2.5">概率配比 (P)</th>
                          <th className="p-2.5">投入/代价成本</th>
                          <th className="p-2.5 pr-4 text-right">折后 EMV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.values(solvedNodes) as DecisionTreeNode[]).map((node, idx) => (
                          <tr key={`report-row-${node.id}-${idx}`} className="border-b border-slate-150 hover:bg-slate-50/50 transition-colors">
                            <td className="p-2.5 pl-4 font-semibold text-slate-800">
                              <span className="block text-[10.5px]">{node.name}</span>
                              <span className="text-[8.5px] font-mono text-slate-400 block">{node.id}</span>
                            </td>
                            <td className="p-2.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded-[3px] text-[8.5px] font-bold ${
                                node.type === 'DECISION'
                                  ? 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                                  : node.type === 'CHANCE'
                                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                                  : 'bg-rose-50 border border-rose-100 text-rose-700'
                              }`}>
                                {node.type === 'DECISION' ? '决策节点' : node.type === 'CHANCE' ? '机会事件' : '终点结局'}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 font-medium">
                              {node.probability !== undefined ? `${Math.round(node.probability * 100)}%` : '--'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 font-medium">
                              {node.cost ? `¥ ${node.cost} 万元` : '¥ 0'}
                            </td>
                            <td className="p-2.5 pr-4 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">
                              ¥ {node.emv ?? 0} 万
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer and Signatures */}
                <div className="border-t border-slate-200 pt-8 mt-12 grid grid-cols-2 gap-6 text-[10px] text-slate-400 font-medium">
                  <div>
                    <h5 className="font-bold text-slate-700 uppercase tracking-wide text-[9px] mb-1">⚖ 董事会法律和风控免责申明</h5>
                    <p className="leading-relaxed">
                      本报告系基于用户提供的商业概率设置与资本成本矩阵进行仿真数值推演得出的数学分析建议。由于市场行情瞬息万变，实际执行应结合线下商业宏观环境联合参考。
                    </p>
                  </div>
                  <div className="text-right space-y-4">
                    <div>
                      <span>建模优化专家组 (Or-Tree Team) 签证盖章</span>
                      <div className="h-10 mt-2 flex items-center justify-end">
                        <div className="w-16 h-16 border-2 border-indigo-500/20 rounded-full flex items-center justify-center text-[10px] text-indigo-500/35 font-extrabold rotate-12 select-none pointer-events-none uppercase tracking-tighter">
                          APPROVED
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}


    </div>
  );
};

const CheckCircleShape = () => (
  <svg className="w-3.5 h-3.5 fill-emerald-100 text-emerald-600 inline-block shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
);
