export type NodeType = 'DECISION' | 'CHANCE' | 'TERMINAL';

export interface DecisionTreeNode {
  id: string;
  name: string;
  type: NodeType;
  parentId?: string;
  probability?: number; // Valid if parent is CHANCE. Value between 0 and 1.
  payoff?: number;      // Payoff at terminal node (or local transition payoff).
  emv?: number;         // Computed Expected Monetary Value
  isPruned?: boolean;   // True if this branch is computed to be suboptimal and pruned
  
  // Custom user parameters
  cost?: number;        // Cost incurred at decision node branch
  confidence?: number;  // AI prediction confidence (0 to 1) for recommendations
  colorTheme?: string;  // Custom color theme for different branches
  enableRiskWarning?: boolean; // Enable high-risk warning
  riskThreshold?: number;      // Warning EMV threshold
}

export interface DecisionTree {
  id: string;
  name: string;
  description: string;
  nodes: Record<string, DecisionTreeNode>;
  rootId: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  version: string;
  tree: DecisionTree;
}

export interface Teammate {
  id: string;
  name: string;
  color: string;
  avatar: string;
  activeNodeId?: string;
  cursorX?: number; // percentage in viewport
  cursorY?: number;
}

export interface SensitivityPoint {
  probability: number; // Value of the first chance branch being analyzed
  emvNodeA: number;    // Resulting EMV for option A
  emvNodeB: number;    // Resulting EMV for option B
  optimalOption: string;
}

export interface StrategyZone {
  p1: number; // Probability of chance 1 (0 to 1)
  p2: number; // Probability of chance 2 (0 to 1)
  optimalId: string; // The ID of the winning decision branch
  color: string;
}
