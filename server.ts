import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to get Gemini client lazily and safely
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// 1. Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// 2. AI semantic parsing: text description -> decision tree
app.post('/api/gemini/parse-tree', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: '请提供自然语言描述文本。' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Return a rich, high-fidelity default parsed response to demo AI capabilities if key is missing
    console.log('Using simulated parser fallback (no API key configured).');
    return res.json({
      simulated: true,
      name: 'AI 导入: 拟投项目决策树',
      description: '根据提供的文本，AI 自动抽取的两阶段投资方案拓扑。',
      nodes: [
        { id: 'root', name: '拟投项目战略路线', type: 'DECISION', parentId: null },
        { id: 'project_alpha', name: '方案1: 参股阿尔法项目', type: 'CHANCE', parentId: 'root', cost: 100 },
        { id: 'alpha_high', name: '高爆发收益 (70%)', type: 'TERMINAL', parentId: 'project_alpha', probability: 0.70, payoff: 400 },
        { id: 'alpha_low', name: '低爆发损益 (30%)', type: 'TERMINAL', parentId: 'project_alpha', probability: 0.30, payoff: -20 },
        { id: 'project_beta', name: '方案2: 全资收购贝塔项目', type: 'CHANCE', parentId: 'root', cost: 250 },
        { id: 'beta_high', name: '高市场接受 (50%)', type: 'TERMINAL', parentId: 'project_beta', probability: 0.50, payoff: 600 },
        { id: 'beta_low', name: '低市场接受 (50%)', type: 'TERMINAL', parentId: 'project_beta', probability: 0.50, payoff: 50 },
        { id: 'project_fixed', name: '方案3: 国债理财直接获益', type: 'TERMINAL', parentId: 'root', payoff: 60 }
      ]
    });
  }

  try {
    const prompt = `你是一个专业的运筹学决策分析专家。现在请阅读下面的决策情景描述，并将其完整、精确地提炼成一个“决策树拓扑数据”。

请遵守以下建模准则：
1. 最顶层根节点的 id 必须是 "root"。所有决策节点和机会节点在往下流动时都要有明确的 parentId 关联。
2. 严格区分以下三种节点类型 (type)：
   - "DECISION": 决策节点（表示决策者需要主动做出选择的分叉口，例如：研发 vs 不研发）。
   - "CHANCE": 机会节点（表示存在随机不确定性的状态分叉口，其所有子分叉项必须有 probability 概率）。
   - "TERMINAL": 最终结局节点（表示不再继续往下分叉，而是有具体 payoffs 损益值，比如净赚或净亏）。
3. 参数提取与归一化：
   - 提取各处的“概率 (probability)”, 或者是“结局损益 (payoff)”，以及选择某个分支需要额外付出的“成本费用 (cost)”。
   - 将数值单位归一化（如文中提到 200万、亏50万，你可以全部换算为以“万元”为单位的数字，例如 200万 -> 200，亏50万 -> -50），确保整个决策树的 payoff 处于同一比例尺下。
   - 确保同一个 CHANCE 节点下的各子节点概率之和应该等于 1.0 (如果文中有微小偏差请自动微调保证数学上的严谨性)。

情景描述文本为：
${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['name', 'description', 'nodes'],
          properties: {
            name: { type: Type.STRING, description: '为此模型取一个专业的决策主题名' },
            description: { type: Type.STRING, description: '根据情节自动总结的精炼业务背景和目标' },
            nodes: {
              type: Type.ARRAY,
              description: '决策树节点列表',
              items: {
                type: Type.OBJECT,
                required: ['id', 'name', 'type'],
                properties: {
                  id: { type: Type.STRING, description: '唯一节点ID (如 root, option_a, outcome_high 等)' },
                  name: { type: Type.STRING, description: '节点或分支名称' },
                  type: { type: Type.STRING, description: 'DECISION, CHANCE, 或者是 TERMINAL' },
                  parentId: { type: Type.STRING, description: '父节点ID (最开始的子节点指向 root)' },
                  probability: { type: Type.NUMBER, description: '概率值（0-1），如果父节点是 CHANCE 则必填' },
                  payoff: { type: Type.NUMBER, description: '结局时的损益（正表示收益，负表示亏损），如果 type 为 TERMINAL 则必填' },
                  cost: { type: Type.NUMBER, description: '此决策或路径的选择成本，如研发成本，属于支出，非必填' }
                }
              }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error('Gemini parse failed:', error);
    res.status(500).json({ error: 'AI 语义解析失败：' + (error.message || error) });
  }
});

// 3. AI recommendation: analyzing calculated tree
app.post('/api/gemini/recommend', async (req, res) => {
  const { tree, solvedNodes } = req.body;
  if (!tree || !solvedNodes) {
    return res.status(400).json({ error: '缺失决策树结构及求解结果。' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      simulated: true,
      analysis: `### 💡 AI 智慧决策透视 (演示模式)

通过 **逆向归纳法 (Backward Induction)** 对当前模型进行整体评估，我们得出以下关键洞察：

1. **核心推演路径：** 
   若当前选用“智能IoT芯片战略选择”的优胜策略，应首选 **路径A: 自主独立研发** (研发初期投入 ¥450k)。
   - 其下属分支“研发成功”概率高达 70%，在成功后进入“营销阶段”，**决策A2: 精益式众筹定制** 提供的期望价值（EMV）比激进渠道大，提供了更稳健的避险区间。
   
2. **风险剖面特征：**
   - **最优EMV：** 整体期望受益超过技术直接授权。
   - **下行极端风险：** 自主研发有 30% 分支以亏损结束，若对现金流极其敏感，建议结合**技术授权** (拥有 ¥450k-$500k 的清货保障空间) 进行两手准备。

3. **敏感决策临界：**
   - 关注**研发成功率**。如果成功率下降至 55% 以下，则整体最优天平将转向“路径B: 购买外部技术授权”。公司需针对此 15% 的偏离安全垫建立实时的预警监控指标。`
    });
  }

  try {
    const prompt = `您是顶尖的运筹学高级商业决策顾问。正在通过决策树（EMV 逆向归纳法）帮助企业分析投资项目。
请基于下方提供的“决策树结构 (Tree)”和“EMV求解后状态 (Solved Nodes)”给出专业的汇报级咨询报告。

决策树名为: ${tree.name}
说明: ${tree.description}

数据记录:
${JSON.stringify({ nodes: solvedNodes }, null, 2)}

请撰写一份中文分析报告，必须排版大方且富有图表化的感觉（推荐使用 Markdown 编写，包括 Emoji），包含以下章节：
1. **🏆 黄金决策路径说明**：明确指出应该选取的最佳步骤路径分支，它能带来的预期货币收益（EMV）是多少，以及为什么该路径比其他被剪枝掉（isPruned=true）的方案更优越。
2. **📈 风险暴露与下行预警**：从概率和结局（Terminal）来看，该最佳策略可能会面临的“最差结局”和概率是多少？如何建立风控制度？
3. **🔧 敏感参数风控临界点**：列举哪些参数波动（如研发成功率、市场暴跌概率、渠道成本等）会最容易改变当前最优解，给出定量的战略避险建议。

字数在 500-800 字左右，语言要谦逊、专业而有力，避免大段枯燥的长文，多用条举。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error('Gemini recommendation failed:', error);
    res.status(500).json({ error: 'AI 智能决策失败：' + (error.message || error) });
  }
});

// Configure Vite middleware in development or static serve in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Operations Research App listening on port ${PORT}`);
  });
}

startServer();
