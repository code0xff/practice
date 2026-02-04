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
  },
  {
    slug: 'keccak-hash',
    title: 'Keccak256 hashing playground',
    summary: 'Hash custom inputs with Keccak256 and review recent results.',
    difficulty: 'Beginner',
    goals: [
      'Understand how a cryptographic hash maps input to output',
      'Experiment with how small input changes alter the hash',
      'Build intuition for fixed-length hash outputs'
    ],
    tasks: [
      'Enter multiple inputs and compare their hashes',
      'Review the saved input/output pairs below the form',
      'Clear the history and repeat with new inputs'
    ]
  },
  {
    slug: 'merkle-tree',
    title: 'Merkle tree explorer',
    summary: 'Build a Merkle tree, inspect hashes, and verify proofs.',
    difficulty: 'Foundations',
    goals: [
      'Understand how Merkle trees aggregate hashes',
      'See how leaf values influence the root',
      'Verify proofs against a chosen root hash'
    ],
    tasks: [
      'Set a depth and fill in leaf values',
      'Generate a proof for a selected leaf',
      'Verify the proof using the Merkle root'
    ]
  },
  {
    slug: 'dh-chat',
    title: 'Diffie-Hellman encrypted chat',
    summary: 'Exchange secp256k1 keys, derive shared secrets, and encrypt messages.',
    difficulty: 'Intermediate',
    goals: [
      'Generate secp256k1 key pairs and share public keys',
      'Derive a shared secret with Diffie-Hellman',
      'Encrypt and decrypt messages using the shared secret'
    ],
    tasks: [
      'Generate keys for both participants',
      'Derive shared secrets after exchanging public keys',
      'Send an encrypted message and decrypt it on the other side'
    ]
  },
  {
    slug: 'pbft-simulation',
    title: 'PBFT consensus simulation',
    summary: 'Simulate propose, prevote, precommit, and commit rounds across four nodes.',
    difficulty: 'Foundations',
    goals: [
      'Understand the PBFT phases and voting thresholds',
      'Observe round-robin proposers and round changes',
      'Track how votes lead to commit decisions'
    ],
    tasks: [
      'Propose a block and collect prevotes',
      'Advance to precommit when 2f+1 votes are reached',
      'Trigger a round change when votes fail'
    ]
  }
];

export const sessionMap = new Map(sessions.map((session) => [session.slug, session]));
