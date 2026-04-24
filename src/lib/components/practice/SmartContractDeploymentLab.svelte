<script lang="ts">
  type Stage = {
    id: string;
    title: string;
    goal: string;
    checks: { id: string; label: string; done: boolean }[];
  };

  const createStages = (): Stage[] => [
    {
      id: 'prepare',
      title: 'Prepare',
      goal: 'Validate the contract shape and constructor inputs before deployment.',
      checks: [
        { id: 'name', label: 'Token name and symbol confirmed', done: false },
        { id: 'owner', label: 'Owner/admin address verified', done: false },
        { id: 'mint', label: 'Initial mint or supply policy decided', done: false }
      ]
    },
    {
      id: 'compile',
      title: 'Compile',
      goal: 'Check that the bytecode and ABI match the source you reviewed.',
      checks: [
        { id: 'optimizer', label: 'Compiler version pinned', done: false },
        { id: 'abi', label: 'ABI matches frontend/backend integration', done: false },
        { id: 'size', label: 'Bytecode size reviewed for deployment cost', done: false }
      ]
    },
    {
      id: 'deploy',
      title: 'Deploy',
      goal: 'Estimate gas, confirm chain settings, and send the transaction.',
      checks: [
        { id: 'chain', label: 'Chain ID and RPC target confirmed', done: false },
        { id: 'balance', label: 'Deployer wallet funded', done: false },
        { id: 'gas', label: 'Gas estimate reviewed with margin', done: false }
      ]
    },
    {
      id: 'verify',
      title: 'Verify',
      goal: 'Verify source and record addresses after deployment.',
      checks: [
        { id: 'source', label: 'Source verification prepared', done: false },
        { id: 'artifact', label: 'ABI and contract address recorded', done: false },
        { id: 'ops', label: 'Post-deploy admin actions listed', done: false }
      ]
    }
  ];

  const sampleContract = `contract SimpleToken {
  string public name;
  string public symbol;
  uint8 public decimals = 18;
  uint256 public totalSupply;
  address public owner;

  constructor(
    string memory _name,
    string memory _symbol,
    uint256 initialSupply,
    address initialOwner
  ) {
    name = _name;
    symbol = _symbol;
    totalSupply = initialSupply;
    owner = initialOwner;
  }
}`;

  let stages = createStages();
  let constructorArgs = 4;
  let bytecodeBytes = 6_200;
  let gasPriceGwei = 12;
  let deployGasLimit = 1_250_000;
  let testnetNativePrice = 2800;
  let reviewNotes = '';

  const toggleCheck = (stageId: string, checkId: string) => {
    stages = stages.map((stage) =>
      stage.id === stageId
        ? {
            ...stage,
            checks: stage.checks.map((check) =>
              check.id === checkId ? { ...check, done: !check.done } : check
            )
          }
        : stage
    );
  };

  const completedChecks = () =>
    stages.reduce((sum, stage) => sum + stage.checks.filter((check) => check.done).length, 0);

  const totalChecks = () => stages.reduce((sum, stage) => sum + stage.checks.length, 0);

  const estimatedDeployGas = () =>
    Math.max(180_000, Math.round(bytecodeBytes * 110 + constructorArgs * 22_000));

  const gasHeadroom = () => deployGasLimit - estimatedDeployGas();

  const deploymentCostEth = () => (deployGasLimit * gasPriceGwei) / 1_000_000_000;

  const deploymentCostUsd = () => deploymentCostEth() * testnetNativePrice;

  const readinessLabel = () => {
    const ratio = completedChecks() / totalChecks();
    if (ratio === 1) return 'Ready to deploy';
    if (ratio >= 0.65) return 'Mostly prepared';
    if (ratio >= 0.35) return 'Preparation incomplete';
    return 'High risk';
  };
</script>

<section class="lab-card">
  <div class="header">
    <div>
      <h3>Contract review</h3>
      <p class="subtle">
        Read the constructor and identify what must be known before a deployment transaction is
        safe to send.
      </p>
    </div>
    <div class="summary-pill">{readinessLabel()}</div>
  </div>
  <pre>{sampleContract}</pre>
</section>

<section class="lab-card">
  <div class="header">
    <div>
      <h3>Deployment cost model</h3>
      <p class="subtle">
        Adjust bytecode size, constructor complexity, and gas settings to see how costs move.
      </p>
    </div>
    <div class="stats-grid">
      <div class="stat">
        <span>Estimated gas</span>
        <strong>{estimatedDeployGas().toLocaleString()}</strong>
      </div>
      <div class="stat">
        <span>Gas headroom</span>
        <strong class:bad={gasHeadroom() < 0}>{gasHeadroom().toLocaleString()}</strong>
      </div>
      <div class="stat">
        <span>Deploy cost</span>
        <strong>{deploymentCostEth().toFixed(6)} ETH</strong>
      </div>
    </div>
  </div>

  <div class="field-grid">
    <label>
      Constructor argument count
      <input type="number" min="0" max="12" step="1" bind:value={constructorArgs} />
    </label>
    <label>
      Bytecode size (bytes)
      <input type="number" min="1000" max="24000" step="100" bind:value={bytecodeBytes} />
    </label>
    <label>
      Gas price (gwei)
      <input type="number" min="1" max="300" step="1" bind:value={gasPriceGwei} />
    </label>
    <label>
      Gas limit
      <input type="number" min="100000" max="8000000" step="10000" bind:value={deployGasLimit} />
    </label>
    <label>
      Native token price (USD)
      <input type="number" min="1" max="10000" step="1" bind:value={testnetNativePrice} />
    </label>
  </div>

  <p class:warning={gasHeadroom() < 0}>
    {#if gasHeadroom() < 0}
      The gas limit is below the rough deployment estimate. This deployment would likely fail.
    {:else}
      Rough fiat cost: ${deploymentCostUsd().toFixed(2)}. Keep extra margin for constructor work
      and network variance.
    {/if}
  </p>
</section>

<section class="lab-card">
  <h3>Pre-deployment checklist</h3>
  <p class="subtle">
    Check each item only after you can explain why it matters. The goal is to rehearse the
    operational flow, not just click everything.
  </p>

  <div class="stage-grid">
    {#each stages as stage}
      <div class="stage-card">
        <h4>{stage.title}</h4>
        <p class="subtle">{stage.goal}</p>
        {#each stage.checks as check}
          <label class="checkbox-row">
            <input
              type="checkbox"
              checked={check.done}
              on:change={() => toggleCheck(stage.id, check.id)}
            />
            <span>{check.label}</span>
          </label>
        {/each}
      </div>
    {/each}
  </div>

  <div class="footer-row">
    <strong>{completedChecks()} / {totalChecks()} checks complete</strong>
    <textarea
      rows="4"
      bind:value={reviewNotes}
      placeholder="Write the last things you would verify before broadcasting the deployment tx."
    ></textarea>
  </div>
</section>

<style>
  .lab-card {
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    background: var(--surface);
    margin-top: 1.5rem;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  pre,
  textarea,
  input {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  }

  pre {
    margin: 0;
    padding: 1rem;
    border-radius: 12px;
    background: var(--background);
    border: 1px solid var(--border);
    overflow-x: auto;
    font-size: 0.8rem;
  }

  .summary-pill {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.35rem 0.8rem;
    color: var(--muted-text);
    background: var(--background);
  }

  .stats-grid,
  .field-grid,
  .stage-grid {
    display: grid;
    gap: 1rem;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .field-grid,
  .stage-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .stat,
  .stage-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.9rem;
    background: var(--background);
    display: grid;
    gap: 0.45rem;
  }

  .stat span,
  .subtle {
    color: var(--muted-text);
  }

  label {
    display: grid;
    gap: 0.45rem;
    font-size: 0.9rem;
  }

  input,
  textarea {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    background: var(--surface);
    color: var(--text);
  }

  .checkbox-row {
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 0.6rem;
  }

  .footer-row {
    display: grid;
    gap: 0.75rem;
  }

  .warning,
  .bad {
    color: #b42318;
  }
</style>
