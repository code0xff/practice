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
    slug: 'utxo-script-machine',
    title: 'UTXO stack script walkthrough',
    summary: 'Step through a Bitcoin script-like stack machine and watch UTXO spending unfold.',
    difficulty: 'Foundations',
    goals: [
      'Connect UTXO spending to scriptSig + scriptPubKey operations',
      'Understand how stack operations validate signatures',
      'Track how a successful script produces a new UTXO'
    ],
    tasks: [
      'Create an initial UTXO with a wallet address and balance',
      'Enter a recipient and start the script execution',
      'Use Next to observe stack changes at each opcode'
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
  },
  {
    slug: 'legacy-tx-lab',
    title: 'Ethereum legacy transaction lab',
    summary: 'Assemble a LegacyTx field-by-field, hash it, sign it, and produce raw RLP output.',
    difficulty: 'Foundations',
    goals: [
      'Understand each LegacyTx field and how it is serialized',
      'Trace how RLP encoding and Keccak hashing produce the transaction hash',
      'Connect signatures (v, r, s) to the final raw transaction bytes'
    ],
    tasks: [
      'Generate a private key and derive the public key and address',
      'Populate LegacyTx fields (nonce, gasPrice, gasLimit, to, value, data, chainId)',
      'RLP-encode the unsigned transaction and compute the keccak256 hash',
      'Sign the hash and extract v, r, s values',
      'Insert the signature fields into the transaction',
      'RLP-encode the signed transaction for eth_sendRawTransaction'
    ]
  },
  {
    slug: 'address-derivation-lab',
    title: 'Address derivation lab (BTC + ETH + Cosmos)',
    summary:
      'Derive Bitcoin, Ethereum, and Cosmos addresses step-by-step from the same private key.',
    difficulty: 'Intermediate',
    goals: [
      'Connect private key material to public keys on secp256k1',
      'Understand Ethereum address derivation and EIP-55 checksums',
      'Compare Bitcoin and Cosmos address derivation using HASH160 and different encodings'
    ],
    tasks: [
      'Generate or input a private key and choose Bitcoin, Ethereum, or Cosmos',
      'Run each derivation step and inspect intermediate values',
      'For Bitcoin, compare P2PKH, P2SH-P2WPKH, and P2WPKH outputs',
      'For Cosmos, derive HASH160(pubkey) and encode to a bech32 cosmos address'
    ]
  }
];

export const sessionMap = new Map(sessions.map((session) => [session.slug, session]));
