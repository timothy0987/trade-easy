// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IVaultOracle} from "./interfaces/IVaultOracle.sol";
import {ITradeVenue} from "./interfaces/ITradeVenue.sol";

/**
 * @title PrivateTradingVault
 * @notice Depositors pool a single asset; an autonomous agent (running in a Vela TEE)
 *         trades the pool on external venues under an on-chain mandate. Shares are
 *         standard ERC-4626. Withdrawals of capital the agent has deployed go through
 *         a redemption queue.
 *
 * @dev    MILESTONE MAP
 *         - M1 (this contract): transparent ERC-4626 accounting + agent mandate +
 *           TEE-liveness gating + emergency redemptions. Positions are still visible
 *           on-chain; the privacy win at M1 comes from running the *strategy* in the
 *           enclave (params/among/timing hidden) and, optionally, routing fills through
 *           a private venue adapter.
 *         - M2: replace per-position disclosure with a committed NAV proven via
 *           zkVerify (`SolvencyVerifier`), and shield the depositor ledger. The mandate
 *           checks below become circuit constraints. `IVaultOracle` / `ITradeVenue`
 *           interfaces are unchanged.
 *
 *         `strategyTag` on `executeTrade` is an opaque bytes32 the agent supplies. At M1
 *         it is a plain label; at M2 it becomes a commitment to the encrypted trade
 *         rationale so the strategy is auditable after the fact without being front-runnable.
 */
contract PrivateTradingVault is ERC4626, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------
    IAgentRegistry public agentRegistry;
    IVaultOracle public oracle;

    // ------------------------------------------------------------------
    // Mandate (governance-controlled; the agent cannot change these)
    // ------------------------------------------------------------------
    mapping(address => bool) public isAllowedToken; // tokens the agent may hold besides `asset`
    mapping(address => bool) public isAllowedVenue; // ITradeVenue adapters the agent may call
    address[] private _heldTokens;                  // non-asset tokens ever received (for NAV)
    mapping(address => bool) private _isHeldTracked;

    uint256 public maxTradeBps;     // per-trade notional cap, as bps of NAV
    uint256 public maxDeployedBps;  // cap on total non-asset value, as bps of NAV
    uint256 public maxDrawdownBps;  // drop from high-water price/share that forces unwind-only
    uint256 public depositCap;      // 0 = uncapped

    // ------------------------------------------------------------------
    // Risk / lifecycle state
    // ------------------------------------------------------------------
    uint256 public highWaterPricePerShare; // WAD-scaled, ratchets up
    bool public unwindOnly;                // true => agent may only trade back toward `asset`
    bool public emergency;                 // true => agent halted, permissionless pro-rata exit
    uint256 public emergencyGracePeriod;   // extra time past agent-death before anyone can trip emergency

    // ------------------------------------------------------------------
    // Fees
    //   management  — annualized on NAV, accrues continuously
    //   performance — a cut of any gain above the high-water price/share
    // Both are charged by MINTING shares to the recipients (dilution), settled lazily
    // on every deposit / withdrawal / redemption settlement / trade, or via accrueFees().
    // A configurable slice of every accrued fee is routed to `stakingPool` (the ZEN
    // staking pool) to satisfy the ecosystem-fund fee-share requirement.
    // ------------------------------------------------------------------
    uint256 public constant MAX_MANAGEMENT_FEE_BPS = 500;    // 5% / year
    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 3_000; // 30% of profit
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    uint256 public managementFeeBps;   // annualized, on NAV
    uint256 public performanceFeeBps;  // on gain above highWaterPricePerShare
    uint256 public stakingFeeShareBps; // portion of every accrued fee routed to stakingPool
    address public feeRecipient;       // manager fee sink
    address public stakingPool;        // ZEN staking pool (address(0) => whole fee to feeRecipient)
    uint256 public lastFeeAccrual;

    // ------------------------------------------------------------------
    // Redemption queue (for withdrawals that exceed idle liquidity)
    // ------------------------------------------------------------------
    struct RedeemRequest {
        address owner;
        uint256 shares;     // escrowed in the vault until processed
        uint256 assetsOwed; // set when processed
        uint64  requestedAt;
        bool    processed;
        bool    claimed;
    }

    RedeemRequest[] public redeemRequests;
    uint256 public reservedAssets; // asset owed to processed-but-unclaimed requests; excluded from NAV

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------
    event MandateTokenSet(address indexed token, bool allowed);
    event MandateVenueSet(address indexed venue, bool allowed);
    event MandateLimitsSet(uint256 maxTradeBps, uint256 maxDeployedBps, uint256 maxDrawdownBps);
    event TradeExecuted(
        address indexed venue,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 strategyTag,
        uint256 navAfter
    );
    event DrawdownBreached(uint256 pricePerShare, uint256 highWaterPricePerShare);
    event UnwindOnlySet(bool value);
    event EmergencyDeclared(address indexed caller);
    event RedeemRequested(uint256 indexed id, address indexed owner, uint256 shares);
    event RedeemProcessed(uint256 indexed id, uint256 assetsOwed);
    event RedeemClaimed(uint256 indexed id, address indexed owner, uint256 assets);
    event FeesAccrued(uint256 managementAssets, uint256 performanceAssets, uint256 sharesMinted, uint256 sharesToStaking);
    event FeeConfigSet(uint256 managementFeeBps, uint256 performanceFeeBps, uint256 stakingFeeShareBps);
    event FeeRecipientsSet(address indexed feeRecipient, address indexed stakingPool);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------
    error NotAgent();
    error AgentNotLive();
    error VenueNotAllowed(address venue);
    error TokenNotAllowed(address token);
    error TradeTooLarge(uint256 valueIn, uint256 cap);
    error DeployedCapExceeded(uint256 deployedValue, uint256 cap);
    error UnwindOnlyActive();
    error SlippageExceeded(uint256 amountOut, uint256 minAmountOut);
    error UseRedemptionQueue(uint256 idleAssets, uint256 requested);
    error DepositCapExceeded();
    error NotEmergency();
    error AgentStillLive();
    error AlreadyProcessed();
    error NotRequestOwner();
    error NotProcessed();
    error AlreadyClaimed();
    error FeeTooHigh();
    error ZeroFeeRecipient();

    modifier onlyAgent() {
        if (msg.sender != agentRegistry.agent()) revert NotAgent();
        _;
    }

    modifier onlyAgentOrOwner() {
        if (msg.sender != agentRegistry.agent() && msg.sender != owner()) revert NotAgent();
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------
    struct MandateConfig {
        uint256 maxTradeBps;
        uint256 maxDeployedBps;
        uint256 maxDrawdownBps;
        uint256 depositCap;
        uint256 emergencyGracePeriod;
    }

    struct FeeConfig {
        uint256 managementFeeBps;
        uint256 performanceFeeBps;
        uint256 stakingFeeShareBps;
        address feeRecipient;
        address stakingPool;
    }

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner,
        IAgentRegistry agentRegistry_,
        IVaultOracle oracle_,
        MandateConfig memory cfg,
        FeeConfig memory fees
    ) ERC20(name_, symbol_) ERC4626(asset_) Ownable(initialOwner) {
        agentRegistry = agentRegistry_;
        oracle = oracle_;
        maxTradeBps = cfg.maxTradeBps;
        maxDeployedBps = cfg.maxDeployedBps;
        maxDrawdownBps = cfg.maxDrawdownBps;
        depositCap = cfg.depositCap;
        emergencyGracePeriod = cfg.emergencyGracePeriod;
        highWaterPricePerShare = WAD; // 1 asset : 1 share at genesis
        emit MandateLimitsSet(cfg.maxTradeBps, cfg.maxDeployedBps, cfg.maxDrawdownBps);

        if (
            fees.managementFeeBps > MAX_MANAGEMENT_FEE_BPS ||
            fees.performanceFeeBps > MAX_PERFORMANCE_FEE_BPS ||
            fees.stakingFeeShareBps > BPS
        ) revert FeeTooHigh();
        if ((fees.managementFeeBps != 0 || fees.performanceFeeBps != 0) && fees.feeRecipient == address(0)) {
            revert ZeroFeeRecipient();
        }
        managementFeeBps = fees.managementFeeBps;
        performanceFeeBps = fees.performanceFeeBps;
        stakingFeeShareBps = fees.stakingFeeShareBps;
        feeRecipient = fees.feeRecipient;
        stakingPool = fees.stakingPool;
        lastFeeAccrual = block.timestamp;
        emit FeeConfigSet(fees.managementFeeBps, fees.performanceFeeBps, fees.stakingFeeShareBps);
        emit FeeRecipientsSet(fees.feeRecipient, fees.stakingPool);
    }

    // ------------------------------------------------------------------
    // NAV
    // ------------------------------------------------------------------
    /// @inheritdoc ERC4626
    function totalAssets() public view override returns (uint256) {
        uint256 total = IERC20(asset()).balanceOf(address(this));
        uint256 n = _heldTokens.length;
        for (uint256 i; i < n; ++i) {
            address t = _heldTokens[i];
            uint256 bal = IERC20(t).balanceOf(address(this));
            if (bal != 0) total += oracle.valueInAsset(t, bal);
        }
        // Assets already spoken for by processed redemptions are not part of NAV.
        return total > reservedAssets ? total - reservedAssets : 0;
    }

    /// @notice Non-asset (deployed) value only.
    function deployedValue() public view returns (uint256 deployed) {
        uint256 n = _heldTokens.length;
        for (uint256 i; i < n; ++i) {
            address t = _heldTokens[i];
            uint256 bal = IERC20(t).balanceOf(address(this));
            if (bal != 0) deployed += oracle.valueInAsset(t, bal);
        }
    }

    function pricePerShare() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return WAD;
        return (totalAssets() * WAD) / supply;
    }

    function heldTokens() external view returns (address[] memory) {
        return _heldTokens;
    }

    // ------------------------------------------------------------------
    // Fees
    // ------------------------------------------------------------------

    /// @notice Settle accrued management + performance fees by minting shares to the
    ///         fee recipient(s). Permissionless; also runs on every deposit, withdrawal,
    ///         redemption settlement and trade.
    function accrueFees() external {
        _accrueFees();
    }

    function _accrueFees() internal {
        uint256 last = lastFeeAccrual;
        lastFeeAccrual = block.timestamp;
        if (emergency) return; // fees freeze once the agent is declared dead

        uint256 supply = totalSupply();
        if (supply == 0) return;
        uint256 assets = totalAssets();
        if (assets == 0) return;

        (uint256 mgmtAssets, uint256 perfAssets) =
            _pendingFeeAssets(supply, assets, block.timestamp - last);
        uint256 feeAssets = mgmtAssets + perfAssets;
        if (feeAssets == 0 || feeAssets >= assets) return;

        // dilution: mint m shares such that  m / (supply + m) == feeAssets / assets
        uint256 feeShares = (supply * feeAssets) / (assets - feeAssets);
        if (feeShares == 0) return;

        uint256 toStaking = stakingPool == address(0) ? 0 : (feeShares * stakingFeeShareBps) / BPS;
        uint256 toManager = feeShares - toStaking;
        if (toStaking != 0) _mint(stakingPool, toStaking);
        if (toManager != 0) _mint(feeRecipient, toManager);

        // Bank the performance fee: ratchet the high-water mark to the post-dilution
        // price so the same gain is never charged twice.
        _ratchetHighWater();

        emit FeesAccrued(mgmtAssets, perfAssets, feeShares, toStaking);
    }

    function _pendingFeeAssets(uint256 supply, uint256 assets, uint256 elapsed)
        internal
        view
        returns (uint256 mgmtAssets, uint256 perfAssets)
    {
        if (managementFeeBps != 0 && elapsed != 0) {
            mgmtAssets = (assets * managementFeeBps * elapsed) / (BPS * SECONDS_PER_YEAR);
        }
        uint256 pps = (assets * WAD) / supply;
        if (performanceFeeBps != 0 && pps > highWaterPricePerShare) {
            uint256 totalGain = ((pps - highWaterPricePerShare) * supply) / WAD;
            perfAssets = (totalGain * performanceFeeBps) / BPS;
        }
    }

    /// @notice Shares that would be minted as fees if settled right now.
    function previewAccruedFeeShares() external view returns (uint256 feeShares) {
        if (emergency) return 0;
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        uint256 assets = totalAssets();
        if (assets == 0) return 0;
        (uint256 mgmtAssets, uint256 perfAssets) =
            _pendingFeeAssets(supply, assets, block.timestamp - lastFeeAccrual);
        uint256 feeAssets = mgmtAssets + perfAssets;
        if (feeAssets == 0 || feeAssets >= assets) return 0;
        feeShares = (supply * feeAssets) / (assets - feeAssets);
    }

    // ------------------------------------------------------------------
    // Deposit guards
    // ------------------------------------------------------------------
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        whenNotPaused
        nonReentrant
    {
        if (depositCap != 0 && totalAssets() + assets > depositCap) revert DepositCapExceeded();
        super._deposit(caller, receiver, assets, shares);
        _ratchetHighWater();
    }

    // ------------------------------------------------------------------
    // Withdraw: only idle liquidity via the standard path; the rest queues
    // ------------------------------------------------------------------
    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (assets > idle) revert UseRedemptionQueue(idle, assets);
        super._withdraw(caller, receiver, owner_, assets, shares);
        _ratchetHighWater();
    }

    // ------------------------------------------------------------------
    // ERC-4626 entrypoints — settle fees before any share/asset conversion
    // ------------------------------------------------------------------
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        _accrueFees();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        _accrueFees();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_) public override returns (uint256) {
        _accrueFees();
        return super.withdraw(assets, receiver, owner_);
    }

    function redeem(uint256 shares, address receiver, address owner_) public override returns (uint256) {
        _accrueFees();
        return super.redeem(shares, receiver, owner_);
    }

    /// @notice Queue a redemption for capital the agent currently has deployed.
    ///         Shares are escrowed now; `assetsOwed` is fixed at NAV when processed.
    function requestRedeem(uint256 shares) external nonReentrant returns (uint256 id) {
        _accrueFees();
        _transfer(msg.sender, address(this), shares); // escrow
        id = redeemRequests.length;
        redeemRequests.push(RedeemRequest({
            owner: msg.sender,
            shares: shares,
            assetsOwed: 0,
            requestedAt: uint64(block.timestamp),
            processed: false,
            claimed: false
        }));
        emit RedeemRequested(id, msg.sender, shares);
    }

    /// @notice Agent (after unwinding) or owner settles queued redemptions at current NAV.
    function processRedeemRequests(uint256[] calldata ids) external onlyAgentOrOwner nonReentrant {
        _accrueFees();
        for (uint256 i; i < ids.length; ++i) {
            RedeemRequest storage r = redeemRequests[ids[i]];
            if (r.processed) revert AlreadyProcessed();
            uint256 assetsOwed = previewRedeem(r.shares);
            _burn(address(this), r.shares);
            r.assetsOwed = assetsOwed;
            r.processed = true;
            reservedAssets += assetsOwed;
            emit RedeemProcessed(ids[i], assetsOwed);
        }
        _ratchetHighWater();
    }

    function claimRedeem(uint256 id) external nonReentrant {
        RedeemRequest storage r = redeemRequests[id];
        if (msg.sender != r.owner) revert NotRequestOwner();
        if (!r.processed) revert NotProcessed();
        if (r.claimed) revert AlreadyClaimed();
        r.claimed = true;
        uint256 amount = r.assetsOwed;
        reservedAssets -= amount;
        IERC20(asset()).safeTransfer(r.owner, amount);
        emit RedeemClaimed(id, r.owner, amount);
    }

    function redeemRequestCount() external view returns (uint256) {
        return redeemRequests.length;
    }

    // ------------------------------------------------------------------
    // Agent trading
    // ------------------------------------------------------------------
    function executeTrade(
        address venue,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 strategyTag,
        bytes calldata venueData
    ) external onlyAgent whenNotPaused nonReentrant returns (uint256 amountOut) {
        if (emergency) revert NotEmergency(); // emergency halts the agent
        if (!agentRegistry.isAgentLive()) revert AgentNotLive();
        if (!isAllowedVenue[venue]) revert VenueNotAllowed(venue);
        _accrueFees();
        _requireTradableToken(tokenIn);
        _requireTradableToken(tokenOut);

        // unwind-only: the agent may only move value back toward the accounting asset
        if (unwindOnly && tokenOut != asset()) revert UnwindOnlyActive();

        // per-trade notional cap vs NAV
        uint256 nav = totalAssets();
        uint256 valueIn = tokenIn == asset() ? amountIn : oracle.valueInAsset(tokenIn, amountIn);
        uint256 tradeCap = (nav * maxTradeBps) / BPS;
        if (valueIn > tradeCap) revert TradeTooLarge(valueIn, tradeCap);

        // route the fill
        uint256 outBefore = IERC20(tokenOut).balanceOf(address(this));
        IERC20(tokenIn).safeTransfer(venue, amountIn);
        amountOut = ITradeVenue(venue).swap(tokenIn, tokenOut, amountIn, minAmountOut, address(this), venueData);
        uint256 received = IERC20(tokenOut).balanceOf(address(this)) - outBefore;
        if (received < minAmountOut) revert SlippageExceeded(received, minAmountOut);
        amountOut = received;

        if (tokenOut != asset()) _trackHeldToken(tokenOut);

        // deployed-capital cap
        uint256 navAfter = totalAssets();
        uint256 deployed = deployedValue();
        uint256 deployedCap = (navAfter * maxDeployedBps) / BPS;
        if (deployed > deployedCap) revert DeployedCapExceeded(deployed, deployedCap);

        // drawdown circuit breaker
        _checkDrawdown();

        emit TradeExecuted(venue, tokenIn, tokenOut, amountIn, amountOut, strategyTag, navAfter);
    }

    function _requireTradableToken(address token) internal view {
        if (token != asset() && !isAllowedToken[token]) revert TokenNotAllowed(token);
    }

    function _trackHeldToken(address token) internal {
        if (!_isHeldTracked[token]) {
            _isHeldTracked[token] = true;
            _heldTokens.push(token);
        }
    }

    function _ratchetHighWater() internal {
        uint256 pps = pricePerShare();
        if (pps > highWaterPricePerShare) {
            highWaterPricePerShare = pps;
            if (unwindOnly) {
                unwindOnly = false; // recovered to a new high; agent may open again
                emit UnwindOnlySet(false);
            }
        }
    }

    function _checkDrawdown() internal {
        uint256 pps = pricePerShare();
        uint256 floor = (highWaterPricePerShare * (BPS - maxDrawdownBps)) / BPS;
        if (pps < floor && !unwindOnly) {
            unwindOnly = true;
            emit DrawdownBreached(pps, highWaterPricePerShare);
            emit UnwindOnlySet(true);
        } else {
            _ratchetHighWater();
        }
    }

    // ------------------------------------------------------------------
    // Emergency: nobody can reach the agent -> permissionless exit
    // ------------------------------------------------------------------
    function declareEmergency() external {
        if (agentRegistry.isAgentLive()) revert AgentStillLive();
        uint256 staleFor =
            agentRegistry.attestationAge() > emergencyGracePeriod ? agentRegistry.attestationAge() : 0;
        if (staleFor == 0) revert AgentStillLive();
        emergency = true;
        _pause();
        emit EmergencyDeclared(msg.sender);
    }

    /// @notice In emergency, redeem shares pro-rata against whatever idle asset is on hand.
    ///         (Deployed positions must be unwound by governance first; this always lets
    ///         depositors recover their share of the liquid remainder.)
    function emergencyRedeem(uint256 shares) external nonReentrant {
        if (!emergency) revert NotEmergency();
        uint256 supply = totalSupply();
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 amount = (idle * shares) / supply;
        _burn(msg.sender, shares);
        IERC20(asset()).safeTransfer(msg.sender, amount);
        emit RedeemClaimed(type(uint256).max, msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Governance
    // ------------------------------------------------------------------
    function setAllowedToken(address token, bool allowed) external onlyOwner {
        isAllowedToken[token] = allowed;
        emit MandateTokenSet(token, allowed);
    }

    function setAllowedVenue(address venue, bool allowed) external onlyOwner {
        isAllowedVenue[venue] = allowed;
        emit MandateVenueSet(venue, allowed);
    }

    function setMandateLimits(uint256 maxTradeBps_, uint256 maxDeployedBps_, uint256 maxDrawdownBps_)
        external
        onlyOwner
    {
        require(maxDrawdownBps_ <= BPS, "drawdown>100%");
        maxTradeBps = maxTradeBps_;
        maxDeployedBps = maxDeployedBps_;
        maxDrawdownBps = maxDrawdownBps_;
        emit MandateLimitsSet(maxTradeBps_, maxDeployedBps_, maxDrawdownBps_);
    }

    function setDepositCap(uint256 cap) external onlyOwner {
        depositCap = cap;
    }

    /// @notice Update fee rates. Settles fees at the OLD rates first.
    function setFees(uint256 managementFeeBps_, uint256 performanceFeeBps_, uint256 stakingFeeShareBps_)
        external
        onlyOwner
    {
        if (
            managementFeeBps_ > MAX_MANAGEMENT_FEE_BPS ||
            performanceFeeBps_ > MAX_PERFORMANCE_FEE_BPS ||
            stakingFeeShareBps_ > BPS
        ) revert FeeTooHigh();
        if ((managementFeeBps_ != 0 || performanceFeeBps_ != 0) && feeRecipient == address(0)) {
            revert ZeroFeeRecipient();
        }
        _accrueFees();
        managementFeeBps = managementFeeBps_;
        performanceFeeBps = performanceFeeBps_;
        stakingFeeShareBps = stakingFeeShareBps_;
        emit FeeConfigSet(managementFeeBps_, performanceFeeBps_, stakingFeeShareBps_);
    }

    /// @notice Update the manager fee sink and the ZEN staking pool. Settles fees first.
    function setFeeRecipients(address feeRecipient_, address stakingPool_) external onlyOwner {
        if ((managementFeeBps != 0 || performanceFeeBps != 0) && feeRecipient_ == address(0)) {
            revert ZeroFeeRecipient();
        }
        _accrueFees();
        feeRecipient = feeRecipient_;
        stakingPool = stakingPool_;
        emit FeeRecipientsSet(feeRecipient_, stakingPool_);
    }

    function setOracle(IVaultOracle oracle_) external onlyOwner {
        oracle = oracle_;
    }

    function setAgentRegistry(IAgentRegistry registry_) external onlyOwner {
        agentRegistry = registry_;
    }

    function setUnwindOnly(bool value) external onlyOwner {
        unwindOnly = value;
        emit UnwindOnlySet(value);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        require(!emergency, "emergency latched");
        _unpause();
    }

    /// @dev Drop a held token from NAV iteration once its balance is permanently zero.
    function pruneHeldToken(uint256 index) external onlyOwner {
        address t = _heldTokens[index];
        require(IERC20(t).balanceOf(address(this)) == 0, "nonzero balance");
        _isHeldTracked[t] = false;
        _heldTokens[index] = _heldTokens[_heldTokens.length - 1];
        _heldTokens.pop();
    }
}
