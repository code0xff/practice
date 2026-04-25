<script lang="ts">
  let tokenAReserve = 100;
  let tokenBReserve = 200_000;
  let depositA = 10;
  let swapInputA = 5;
  let feeBps = 30;
  let externalPrice = 2300;

  const lpShare = () => depositA / tokenAReserve;
  const requiredDepositB = () => depositA * (tokenBReserve / tokenAReserve);
  const poolPriceBefore = () => tokenBReserve / tokenAReserve;
  const feeRate = () => feeBps / 10_000;
  const effectiveInput = () => swapInputA * (1 - feeRate());
  const newReserveA = () => tokenAReserve + effectiveInput();
  const invariant = () => tokenAReserve * tokenBReserve;
  const newReserveB = () => invariant() / newReserveA();
  const outputB = () => tokenBReserve - newReserveB();
  const poolPriceAfter = () => newReserveB() / (tokenAReserve + swapInputA);
  const priceImpact = () => ((poolPriceBefore() - poolPriceAfter()) / poolPriceBefore()) * 100;
  const feesEarnedInA = () => swapInputA * feeRate();

  const hodlValue = () => depositA * externalPrice + requiredDepositB();
  const positionTokenA = () => Math.sqrt(invariant() / externalPrice);
  const positionTokenB = () => positionTokenA() * externalPrice;
  const lpValueAtExternalPrice = () => positionTokenA() + positionTokenB();
  const impermanentLoss = () => ((lpValueAtExternalPrice() - hodlValue()) / hodlValue()) * 100;
</script>

<section class="lab-card">
  <div class="header">
    <div>
      <h3>AMM pool setup</h3>
      <p class="subtle">
        Use a simple constant-product pool to see how LP deposits, swap fees, and price impact
        interact.
      </p>
    </div>
    <div class="stat-pill">k = {invariant().toFixed(2)}</div>
  </div>

  <div class="field-grid">
    <label>
      Token A reserve
      <input type="number" min="1" step="1" bind:value={tokenAReserve} />
    </label>
    <label>
      Token B reserve
      <input type="number" min="1" step="100" bind:value={tokenBReserve} />
    </label>
    <label>
      LP deposit in Token A
      <input type="number" min="0.1" step="0.1" bind:value={depositA} />
    </label>
    <label>
      Swap input in Token A
      <input type="number" min="0.1" step="0.1" bind:value={swapInputA} />
    </label>
    <label>
      Fee (bps)
      <input type="number" min="1" max="300" step="1" bind:value={feeBps} />
    </label>
    <label>
      External price of Token A in Token B
      <input type="number" min="100" step="10" bind:value={externalPrice} />
    </label>
  </div>
</section>

<section class="lab-card">
  <h3>Liquidity provisioning</h3>
  <div class="stats-grid">
    <div class="stat">
      <span>Pool price</span>
      <strong>{poolPriceBefore().toFixed(2)} B per A</strong>
    </div>
    <div class="stat">
      <span>Required Token B</span>
      <strong>{requiredDepositB().toFixed(2)}</strong>
    </div>
    <div class="stat">
      <span>LP share</span>
      <strong>{(lpShare() * 100).toFixed(2)}%</strong>
    </div>
  </div>
  <p class="subtle">
    To avoid moving the pool price when depositing, the LP must add assets in the current pool
    ratio.
  </p>
</section>

<section class="lab-card">
  <h3>Swap simulation</h3>
  <div class="stats-grid">
    <div class="stat">
      <span>Token B out</span>
      <strong>{outputB().toFixed(2)}</strong>
    </div>
    <div class="stat">
      <span>Fee retained by pool</span>
      <strong>{feesEarnedInA().toFixed(4)} A</strong>
    </div>
    <div class="stat">
      <span>Price impact</span>
      <strong>{priceImpact().toFixed(2)}%</strong>
    </div>
    <div class="stat">
      <span>Post-swap pool price</span>
      <strong>{poolPriceAfter().toFixed(2)} B per A</strong>
    </div>
  </div>
  <p class="subtle">
    Larger swaps consume more of the curve, so the realized execution price drifts away from the
    starting pool price.
  </p>
</section>

<section class="lab-card">
  <h3>AMM flow visualization</h3>
  <p class="subtle">
    The pool keeps x * y = k. Swaps add Token A, remove Token B, and retain the fee inside the pool.
  </p>
  <div class="amm-visual">
    <div class="asset-node">
      <span>Trader input</span>
      <strong>{swapInputA.toFixed(4)} A</strong>
      <small>fee: {feesEarnedInA().toFixed(4)} A</small>
    </div>
    <div class="flow-arrow">→</div>
    <div class="pool-node">
      <span>Constant product pool</span>
      <strong>{tokenAReserve.toFixed(2)} A / {tokenBReserve.toFixed(2)} B</strong>
      <small>k = {invariant().toFixed(2)}</small>
    </div>
    <div class="flow-arrow">→</div>
    <div class="asset-node">
      <span>Trader output</span>
      <strong>{outputB().toFixed(4)} B</strong>
      <small>price impact {priceImpact().toFixed(2)}%</small>
    </div>
  </div>
  <div class="reserve-bars">
    <div>
      <span>Token A after swap</span>
      <strong>{(tokenAReserve + swapInputA).toFixed(4)}</strong>
    </div>
    <div>
      <span>Token B after swap</span>
      <strong>{newReserveB().toFixed(4)}</strong>
    </div>
  </div>
</section>

<section class="lab-card">
  <h3>LP risk check</h3>
  <div class="stats-grid">
    <div class="stat">
      <span>Hold-only value</span>
      <strong>{hodlValue().toFixed(2)} B</strong>
    </div>
    <div class="stat">
      <span>LP position value</span>
      <strong>{lpValueAtExternalPrice().toFixed(2)} B</strong>
    </div>
    <div class="stat">
      <span>Impermanent loss</span>
      <strong class:warning={impermanentLoss() < 0}>{impermanentLoss().toFixed(2)}%</strong>
    </div>
  </div>
  <p class="subtle">
    This compares an LP position against simply holding the deposited assets while the external
    market price moves.
  </p>
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
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .field-grid,
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  label,
  .stat {
    display: grid;
    gap: 0.45rem;
  }

  label {
    font-size: 0.9rem;
  }

  input {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    background: var(--surface);
    color: var(--text);
  }

  .stat,
  .stat-pill {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.85rem;
    background: var(--background);
  }

  .stat span,
  .subtle {
    color: var(--muted-text);
  }

  .stat-pill {
    border-radius: 999px;
    padding: 0.35rem 0.8rem;
  }

  .warning {
    color: #b42318;
  }

  .amm-visual {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.4fr) auto minmax(0, 1fr);
    gap: 0.75rem;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1rem;
    background: var(--background);
  }

  .asset-node,
  .pool-node,
  .reserve-bars div {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.9rem;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .pool-node {
    border-color: #2563eb;
    text-align: center;
  }

  .asset-node span,
  .pool-node span,
  .reserve-bars span {
    color: var(--muted-text);
    font-size: 0.8rem;
  }

  .asset-node small,
  .pool-node small {
    color: var(--muted-text);
  }

  .flow-arrow {
    display: grid;
    place-items: center;
    color: var(--muted-text);
  }

  .reserve-bars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  @media (max-width: 720px) {
    .amm-visual {
      grid-template-columns: 1fr;
    }

    .flow-arrow {
      transform: rotate(90deg);
    }
  }
</style>
