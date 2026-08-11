import { DecisionTree } from './types';

export const createDefaultTree = (): DecisionTree => {
  return {
    id: 'default-tech-investment',
    name: '自主研发 vs 技术授权 运筹决策模型',
    description: '评估高科技企业针对新一代智能物联模组的发展决策。包含自主研发与购买授权两条大类路径，多级市场概率波动和商业化宣发投资，帮助决策层进行期望货币价值（EMV）演化与敏感性推演。',
    rootId: 'root',
    nodes: {
      'root': {
        id: 'root',
        name: '智能IoT芯片战略选择',
        type: 'DECISION',
      },
      // ====== PATH 1: 自主研发 ======
      'independent_rd': {
        id: 'independent_rd',
        name: '路径A: 自主独立研发',
        type: 'CHANCE',
        parentId: 'root',
        cost: 450, // ¥45万研发预算
      },
      'rd_success': {
        id: 'rd_success',
        name: '研发成功',
        type: 'DECISION',
        parentId: 'independent_rd',
        probability: 0.70, // 70% 概率成功
      },
      'rd_fail': {
        id: 'rd_fail',
        name: '研发失败',
        type: 'TERMINAL',
        parentId: 'independent_rd',
        probability: 0.30, // 30% 概率失败
        payoff: -150, // 扣除废料残值，净亏15万
        confidence: 0.95,
      },
      // 研发成功分支下 -> 选择营销模式
      'marketing_agg': {
        id: 'marketing_agg',
        name: '决策A1: 激进式全渠道宣发',
        type: 'CHANCE',
        parentId: 'rd_success',
        cost: 200, // ¥20万营销投入
      },
      'marketing_lean': {
        id: 'marketing_lean',
        name: '决策A2: 精益式众筹定制',
        type: 'CHANCE',
        parentId: 'rd_success',
        cost: 50, // ¥5万营销投入
      },
      // 激进式下 -> 市场反馈
      'agg_high_demand': {
        id: 'agg_high_demand',
        name: '高爆发需求',
        type: 'TERMINAL',
        parentId: 'marketing_agg',
        probability: 0.60,
        payoff: 2200, // 220万
        confidence: 0.85,
      },
      'agg_low_demand': {
        id: 'agg_low_demand',
        name: '低迷反应',
        type: 'TERMINAL',
        parentId: 'marketing_agg',
        probability: 0.40,
        payoff: 400, // 40万
        confidence: 0.78,
      },
      // 精益式下 -> 众筹反馈
      'lean_high_demand': {
        id: 'lean_high_demand',
        name: '众筹爆单',
        type: 'TERMINAL',
        parentId: 'marketing_lean',
        probability: 0.80,
        payoff: 1200, // 120万
        confidence: 0.90,
      },
      'lean_low_demand': {
        id: 'lean_low_demand',
        name: '未达众筹线',
        type: 'TERMINAL',
        parentId: 'marketing_lean',
        probability: 0.20,
        payoff: 150, // 15万仅覆盖起订起购
        confidence: 0.82,
      },

      // ====== PATH 2: 技术授权 ======
      'tech_licensing': {
        id: 'tech_licensing',
        name: '路径B: 购买外部技术授权',
        type: 'CHANCE',
        parentId: 'root',
        cost: 700, // ¥70万授权引进费
      },
      'license_high_accept': {
        id: 'license_high_accept',
        name: '市场接受度高',
        type: 'TERMINAL',
        parentId: 'tech_licensing',
        probability: 0.65, // 65%概率
        payoff: 1900, // 190万
        confidence: 0.88,
      },
      'license_low_accept': {
        id: 'license_low_accept',
        name: '市场反弹/山寨竞抢',
        type: 'TERMINAL',
        parentId: 'tech_licensing',
        probability: 0.35, // 35%
        payoff: 450, // 45万清货
        confidence: 0.80,
      },

      // ====== PATH 3: 放弃不投 ======
      'abandon_project': {
        id: 'abandon_project',
        name: '路径C: 固收资金存款/保守理财',
        type: 'TERMINAL',
        parentId: 'root',
        payoff: 80, // ¥8万稳妥利息收益
        confidence: 0.99,
      }
    }
  };
};
