import { DecisionTree, DecisionTreeNode } from '../types';

export interface AISettings {
  apiKey: string;
  model: string;
  customEndpoint?: string;
}

export function getSavedAISettings(): AISettings {
  const saved = localStorage.getItem('or_tree_ai_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      // ignore parsing error
    }
  }
  return {
    apiKey: '',
    model: 'gemini-2.5-flash',
    customEndpoint: ''
  };
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem('or_tree_ai_settings', JSON.stringify(settings));
}

// Extract JSON block from string if model returns markdown block
function extractJsonFromString(str: string): any {
  try {
    // Attempt parsing directly
    return JSON.parse(str.trim());
  } catch (e) {
    // Attempt markdown json match
    const match = str.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch (err) {
        // Fallback to any brace extraction
      }
    }
    
    // Attempt finding first { and last }
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(str.substring(firstBrace, lastBrace + 1).trim());
      } catch (err) {
        // Fallback
      }
    }
    throw new Error('未能从模型返回的数据中解析出有效的JSON格式，请重试。原始返回：' + str.substring(0, 200));
  }
}

/**
 * Parses decision story text to JSON DecisionTree nodes.
 */
export async function parseTreeWithAI(text: string, settings: AISettings): Promise<any> {
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

你必须返回一个符合以下结构的 JSON 对象：
{
  "name": "决策主题名称",
  "description": "业务背景和目标总结",
  "nodes": [
    {
      "id": "唯一ID",
      "name": "名称",
      "type": "DECISION | CHANCE | TERMINAL",
      "parentId": "父节点ID或null",
      "probability": 概率数值(0到1),
      "payoff": 结局损益数值,
      "cost": 路径选择成本数值
    }
  ]
}

情景描述文本为：
${text}`;

  // If client-side API Key is available, fetch directly to avoid server requirements!
  if (settings.apiKey) {
    const isDeepSeek = settings.model.includes('deepseek') || settings.model.includes('r1') || settings.model.includes('v4');
    if (isDeepSeek) {
      const resultText = await fetchDeepSeekBrowser(prompt, settings.apiKey, settings.model, settings.customEndpoint);
      return extractJsonFromString(resultText);
    } else {
      // Gemini call
      const schema = {
        type: 'OBJECT',
        required: ['name', 'description', 'nodes'],
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          nodes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              required: ['id', 'name', 'type'],
              properties: {
                id: { type: 'STRING' },
                name: { type: 'STRING' },
                type: { type: 'STRING' },
                parentId: { type: 'STRING' },
                probability: { type: 'NUMBER' },
                payoff: { type: 'NUMBER' },
                cost: { type: 'NUMBER' }
              }
            }
          }
        }
      };
      const resultText = await fetchGeminiBrowser(prompt, settings.apiKey, settings.model, schema);
      return JSON.parse(resultText);
    }
  }

  // Fallback to Express backend if no local key (and not on static pages)
  const response = await fetch('/api/gemini/parse-tree', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error('AI解析接口请求失败，如果项目部署在GitHub Pages，请点击齿轮输入个人的 API Key 直连大模型。');
  }

  return response.json();
}

/**
 * Generates unified report recommendation.
 */
export async function generateRecommendationWithAI(
  tree: DecisionTree,
  solvedNodes: Record<string, DecisionTreeNode>,
  settings: AISettings
): Promise<string> {
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

  if (settings.apiKey) {
    const isDeepSeek = settings.model.includes('deepseek') || settings.model.includes('r1') || settings.model.includes('v4');
    if (isDeepSeek) {
      return fetchDeepSeekBrowser(prompt, settings.apiKey, settings.model, settings.customEndpoint);
    } else {
      return fetchGeminiBrowser(prompt, settings.apiKey, settings.model);
    }
  }

  // Fallback to Express server
  const response = await fetch('/api/gemini/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tree, solvedNodes })
  });

  if (!response.ok) {
    throw new Error('服务调用失败。如果部署在GitHub Pages，请点击右上角设置图标手动配置您的 API Key。');
  }

  const data = await response.json();
  return data.analysis || '无法获取推荐报告';
}

/**
 * Direct chat interaction with LLM.
 */
export async function chatWithAI(
  userMessage: string,
  history: { role: 'user' | 'model'; content: string }[],
  tree: DecisionTree,
  solvedNodes: Record<string, DecisionTreeNode>,
  settings: AISettings
): Promise<string> {
  const systemPrompt = `您是顶尖的运筹学高级商业决策顾问和“战棋大模型洞察助手”。
您目前正与一位企业决策者进行实时互动，当前他们正在分析以下决策树项目模型：

项目名称：${tree.name}
项目背景：${tree.description}
已求解节点状态数据（包含各分支算出的 EMV 及是否被剪枝 isPruned 等信息）：
${JSON.stringify({ nodes: solvedNodes }, null, 2)}

请结合以上模型数据和求解状态，用严谨、专业、极富洞察力的口吻，回答用户的后续追问。
支持各种假设性场景分析（例如："如果成功率变为50%会怎样？"、"如果成本增加100万，应该选哪个？" 等）。
回答要清晰、重点突出（多用列表或 Markdown 加粗），字数不宜过多，控制在 250-400 字内。`;

  // Construct complete contextual user message including prompt instructions and chat history
  const historyText = history.map(h => `${h.role === 'user' ? '用户' : '助理'}: ${h.content}`).join('\n');
  const fullPrompt = `${systemPrompt}\n\n[对话上下文历史]:\n${historyText}\n\n最新用户提问: ${userMessage}\n助理回复:`;

  if (settings.apiKey) {
    const isDeepSeek = settings.model.includes('deepseek') || settings.model.includes('r1') || settings.model.includes('v4');
    if (isDeepSeek) {
      return fetchDeepSeekBrowser(fullPrompt, settings.apiKey, settings.model, settings.customEndpoint);
    } else {
      return fetchGeminiBrowser(fullPrompt, settings.apiKey, settings.model);
    }
  }

  // Fallback server chat endpoint proxy (if they don't have apiKey)
  const response = await fetch('/api/gemini/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      tree, 
      solvedNodes,
      // Provide custom contextual prompt as temporary mock
      customPrompt: fullPrompt 
    })
  });

  if (!response.ok) {
    throw new Error('未配置 API Key 且后端连接失败，请在设置齿轮中配置您的浏览器端 API Key。');
  }

  const data = await response.json();
  return data.analysis || '大模型暂时无法解答您的疑问。';
}

/**
 * Fetch helpers
 */
async function fetchGeminiBrowser(prompt: string, apiKey: string, model: string, responseSchema?: any): Promise<string> {
  // Use standard Google developer REST API URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const body: any = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  if (responseSchema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: responseSchema
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch (e) {}
    const errMsg = parsedErr?.error?.message || errText;
    throw new Error(`Google API 错误: ${response.status} - ${errMsg}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API 未返回有效文本。请确认您的 API Key 及网络连通性。');
  }
  return text;
}

async function fetchDeepSeekBrowser(prompt: string, apiKey: string, model: string, customEndpoint?: string): Promise<string> {
  const url = customEndpoint || 'https://api.deepseek.com/chat/completions';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'deepseek-v4-pro',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errText);
    } catch (e) {}
    const errMsg = parsedErr?.error?.message || errText;
    throw new Error(`DeepSeek API 错误: ${response.status} - ${errMsg}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('DeepSeek API 未返回有效文本。请确认 API Key 及网络连通性。');
  }
  return text;
}
