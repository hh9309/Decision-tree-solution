import { DecisionTree, DecisionTreeNode, SensitivityPoint, StrategyZone } from './types';

/**
 * Executes the Backward Induction algorithm on a decision tree using EMV.
 * Calculates EMV for every node and sets isPruned=true for suboptimal branches.
 */
export function runBackwardInduction(tree: DecisionTree): Record<string, DecisionTreeNode> {
  const nodes = JSON.parse(JSON.stringify(tree.nodes)) as Record<string, DecisionTreeNode>;

  const getChildren = (parentId: string): DecisionTreeNode[] => {
    return Object.values(nodes).filter(n => n.parentId === parentId);
  };

  // 1. Reset metrics
  for (const id in nodes) {
    nodes[id].emv = undefined;
    nodes[id].isPruned = false;
  }

  // 2. Recursive solver helper
  function solveNode(id: string): number {
    const node = nodes[id];
    if (!node) return 0;
    
    const children = getChildren(id);

    // Terminal Node
    if (node.type === 'TERMINAL' || children.length === 0) {
      node.emv = node.payoff ?? 0;
      return node.emv;
    }

    // Solve all children first
    children.forEach(child => solveNode(child.id));

    // Chance Node: EMV is the weighted sum of children EMVs minus any cost
    if (node.type === 'CHANCE') {
      let sum = 0;
      let totalP = 0;
      
      children.forEach(child => {
        const p = child.probability ?? 0;
        totalP += p;
        // Cost at branch is subtracted from child's emv before weights or here?
        // Traditionally, child EMV represents downstream, and cost is subtracted
        const childVal = (child.emv ?? 0) - (child.cost ?? 0);
        sum += p * childVal;
      });

      // Normalization if needed (though we encourage 1.0)
      if (totalP > 0 && Math.abs(totalP - 1) > 0.001) {
        sum = sum / totalP;
      }
      
      node.emv = Math.round(sum * 10) / 10;
      return node.emv;
    } 
    // Decision Node: EMV is the maximum of children EMVs (after costs)
    else {
      let maxVal = -Infinity;
      let bestChildId = '';

      children.forEach(child => {
        const childVal = (child.emv ?? 0) - (child.cost ?? 0);
        if (childVal > maxVal) {
          maxVal = childVal;
          bestChildId = child.id;
        }
      });

      if (maxVal === -Infinity) maxVal = 0;

      // Mark other decisions as pruned
      children.forEach(child => {
        if (child.id !== bestChildId) {
          child.isPruned = true;
          // Cascade pruned state to all descendants
          cascadePruning(child.id);
        }
      });

      node.emv = Math.round(maxVal * 10) / 10;
      return node.emv;
    }
  }

  function cascadePruning(parentId: string) {
    const children = getChildren(parentId);
    children.forEach(child => {
      child.isPruned = true;
      cascadePruning(child.id);
    });
  }

  solveNode(tree.rootId);
  return nodes;
}

/**
 * Layout the tree utilizing DFS leaf sorting for beautiful horizontal hierarchy with zero line crossing.
 * Returns an absolute coordinates mapping.
 */
export function layoutTree(
  tree: DecisionTree, 
  width: number = 900, 
  height: number = 550
): { nodes: Record<string, { x: number; y: number; depth: number }>; maxDepth: number } {
  const nodes = tree.nodes;
  const rootId = tree.rootId;

  const getChildren = (parentId: string): string[] => {
    return Object.values(nodes)
      .filter(n => n.parentId === parentId)
      // Deterministically sort to maintain visual order
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(n => n.id);
  };

  // 1. Calculate depths
  const nodeDepths: Record<string, number> = {};
  let maxDepth = 0;

  function computedepth(id: string, depth: number) {
    nodeDepths[id] = depth;
    if (depth > maxDepth) maxDepth = depth;
    const children = getChildren(id);
    children.forEach(c => computedepth(c, depth + 1));
  }
  
  if (nodes[rootId]) {
    computedepth(rootId, 0);
  }

  // 2. Extract leaves in DFS order
  const leaves: string[] = [];
  function collectLeavesDFS(id: string) {
    const children = getChildren(id);
    if (children.length === 0) {
      leaves.push(id);
    } else {
      children.forEach(c => collectLeavesDFS(c));
    }
  }
  
  if (nodes[rootId]) {
    collectLeavesDFS(rootId);
  }

  // 3. Coordinate layouts
  const coords: Record<string, { x: number; y: number; depth: number }> = {};
  
  // Assign Y to leaves equally spaced
  const paddingX = 80;
  const paddingY = 60;
  const activeWidth = width - paddingX * 2;
  const activeHeight = height - paddingY * 2;

  const leafCount = leaves.length;
  const ySpacing = leafCount > 1 ? activeHeight / (leafCount - 1) : activeHeight / 2;

  leaves.forEach((leafId, index) => {
    const depth = nodeDepths[leafId] || 0;
    // X is proportional to depth
    coords[leafId] = {
      x: paddingX + (depth / (maxDepth || 1)) * activeWidth,
      y: paddingY + index * ySpacing,
      depth
    };
  });

  // Calculate Y for internal nodes bottom-up (centroid of children)
  function computeInternalCoords(id: string): { x: number; y: number; depth: number } {
    if (coords[id]) return coords[id];

    const children = getChildren(id);
    const depth = nodeDepths[id] || 0;
    const xCoord = paddingX + (depth / (maxDepth || 1)) * activeWidth;

    if (children.length === 0) {
      // should already be covered, but fallback
      return { x: xCoord, y: paddingY + activeHeight / 2, depth };
    }

    const calculatedChildren = children.map(c => computeInternalCoords(c));
    const avgY = calculatedChildren.reduce((sum, curr) => sum + curr.y, 0) / children.length;

    coords[id] = {
      x: xCoord,
      y: avgY,
      depth
    };
    return coords[id];
  }

  if (nodes[rootId]) {
    computeInternalCoords(rootId);
  }

  return { nodes: coords, maxDepth };
}

/**
 * Analyses how a single chance tree's probabilities alter the overall EMV of the main branches.
 * We vary the probability 'p' of the primary option from 0.0 to 1.0.
 */
export function runSensitivityAnalysis(
  tree: DecisionTree,
  chanceNodeId: string,
  branch1Id: string, // the branch whose probability we vary
  branch2Id: string  // the other branch (p_other = 1 - p)
): SensitivityPoint[] {
  const results: SensitivityPoint[] = [];
  
  // Find which root decisions are influenced
  // Let's sweep probability 'p' from 0 to 1
  for (let i = 0; i <= 20; i++) {
    const p = Math.round((i * 0.05) * 100) / 100;
    
    // Create a temporary cloned tree with p and 1-p allocated
    const tempTree = JSON.parse(JSON.stringify(tree)) as DecisionTree;
    if (tempTree.nodes[branch1Id] && tempTree.nodes[branch2Id]) {
      tempTree.nodes[branch1Id].probability = p;
      tempTree.nodes[branch2Id].probability = Math.round((1 - p) * 100) / 100;
    }
    
    const solvedNodes = runBackwardInduction(tempTree);
    
    // Read EMV of top root decisions
    // Let's find first-level children of root
    const rootChildren = (Object.values(solvedNodes) as DecisionTreeNode[]).filter(n => n.parentId === tree.rootId);
    
    const nodeA = rootChildren[0];
    const nodeB: DecisionTreeNode = rootChildren[1] || { 
      id: 'empty', 
      name: '理财收益', 
      type: 'TERMINAL', 
      emv: 0, 
      cost: 0 
    };

    const emvA = (nodeA.emv ?? 0) - (nodeA.cost ?? 0);
    const emvB = (nodeB.emv ?? 0) - (nodeB.cost ?? 0);

    let optimal = nodeA.name;
    if (emvB > emvA) optimal = nodeB.name;
    
    results.push({
      probability: p,
      emvNodeA: Math.round(emvA * 10) / 10,
      emvNodeB: Math.round(emvB * 10) / 10,
      optimalOption: optimal
    });
  }
  
  return results;
}

/**
 * Computes Risk Profiles (CDF / PMF) for each primary option off the root node.
 * For a given option, it recursively searches all terminal node paths, multiplying probabilities,
 * to form a probability distribution.
 */
export interface RiskProfileOutcome {
  payoff: number;
  probability: number;
}

export function getRiskProfile(
  tree: DecisionTree,
  rootOptionId: string
): { pmf: RiskProfileOutcome[]; cdf: RiskProfileOutcome[] } {
  const outcomes: RiskProfileOutcome[] = [];

  function gatherOutcomes(nodeId: string, accumulatedProb: number, accumulatedCost: number) {
    const node = tree.nodes[nodeId];
    if (!node) return;

    const children = Object.values(tree.nodes).filter(n => n.parentId === nodeId);
    const currentCost = accumulatedCost + (node.cost ?? 0);

    if (node.type === 'TERMINAL' || children.length === 0) {
      outcomes.push({
        payoff: (node.payoff ?? 0) - currentCost,
        probability: accumulatedProb
      });
      return;
    }

    if (node.type === 'CHANCE') {
      children.forEach(c => {
        gatherOutcomes(c.id, accumulatedProb * (c.probability ?? 0), currentCost);
      });
    } else {
      // In decision node, user will pick the optimal (or we look at all paths to see potential).
      // For risk profile, we evaluate the optimal decision branches or average?
      // Since it's a decision node and solved, we follow the un-pruned path!
      // This is the OR method: evaluate risk of implementing the optimized strategy.
      const solvedNodes = runBackwardInduction(tree);
      const activeChild = children.find(c => {
        const solvedNode = solvedNodes[c.id];
        return solvedNode && !solvedNode.isPruned;
      });

      if (activeChild) {
        gatherOutcomes(activeChild.id, accumulatedProb, currentCost);
      } else if (children.length > 0) {
        // fallback
        gatherOutcomes(children[0].id, accumulatedProb, currentCost);
      }
    }
  }

  gatherOutcomes(rootOptionId, 1.0, 0);

  // Group by exact payoff, sum probabilities
  const grouped: Record<number, number> = {};
  outcomes.forEach(o => {
    grouped[o.payoff] = (grouped[o.payoff] || 0) + o.probability;
  });

  const pmf: RiskProfileOutcome[] = Object.keys(grouped)
    .map(payoffStr => ({
      payoff: Number(payoffStr),
      probability: Math.round(grouped[Number(payoffStr)] * 1000) / 1000
    }))
    .sort((a, b) => a.payoff - b.payoff);

  // Calculate Cumulative Distribution Function (CDF)
  let cumProb = 0;
  const cdf: RiskProfileOutcome[] = pmf.map(p => {
    cumProb += p.probability;
    return {
      payoff: p.payoff,
      probability: Math.round(cumProb * 1000) / 1000
    };
  });

  return { pmf, cdf };
}
