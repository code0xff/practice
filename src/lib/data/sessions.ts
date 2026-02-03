export type PracticeSession = {
  slug: string;
  title: string;
  summary: string;
  difficulty: 'Beginner' | 'Foundations' | 'Intermediate';
  goals: string[];
  tasks: string[];
};

export const sessions: PracticeSession[] = [
  {
    slug: 'intro-wallet',
    title: 'Bitcoin PoW visualization',
    summary: 'Simulate proof-of-work mining and watch difficulty adjust to your target block time.',
    difficulty: 'Beginner',
    goals: [
      'Understand how proof-of-work difficulty influences block time',
      'Visualize nonce search and hash targets',
      'Interpret basic block metadata'
    ],
    tasks: [
      'Set a target block time and observe difficulty adjustments',
      'Start and stop mining while watching the nonce counter',
      'Clear stored blocks to reset the simulation'
    ]
  },
  {
    slug: 'smart-contract',
    title: 'Smart contract deployment flow',
    summary: 'Review contract structure and build a pre-deployment checklist.',
    difficulty: 'Foundations',
    goals: [
      'Understand the deployment stages',
      'Identify how gas fees are calculated',
      'Complete a deployment checklist'
    ],
    tasks: [
      'Read the structure of a simple token contract',
      'Outline preparation steps for each deployment stage',
      'Check expected costs on a testnet'
    ]
  },
  {
    slug: 'defi-flow',
    title: 'DeFi simulation',
    summary: 'Plan liquidity provisioning and swap scenarios.',
    difficulty: 'Intermediate',
    goals: ['Understand AMM mechanics', 'Summarize fee calculations', 'Build a risk checklist'],
    tasks: [
      'Explain how fees accrue in a liquidity pool',
      'List price movement factors during swaps',
      'Draft a risk checklist'
    ]
  },
  {
    slug: 'utxo-simulation',
    title: 'UTXO creation and transfer simulation',
    summary: 'Create UTXOs, send funds, and visualize how outputs split and merge.',
    difficulty: 'Foundations',
    goals: [
      'Understand how UTXOs represent spendable balances',
      'Practice building transactions with multiple inputs and outputs',
      'Visualize how UTXOs split or merge after a transfer'
    ],
    tasks: [
      'Initialize a wallet with a custom or random address',
      'Send funds to a new address and inspect the resulting outputs',
      'Clear the ledger and start again to compare behaviors'
    ]
  }
];

export const sessionMap = new Map(sessions.map((session) => [session.slug, session]));
