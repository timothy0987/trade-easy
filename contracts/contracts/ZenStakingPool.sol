// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZenStakingPool
 * @notice ZEN stakers earn a pro-rata share of the protocol fees the
 *         PrivateTradingVault routes here (see `stakingFeeShareBps`).
 *
 *         Rewards arrive as plain ERC-20 transfers: the vault mints `rewardToken`
 *         (its own ptVAULT shares) directly to this contract on every fee accrual.
 *         A MasterChef-style accumulator splits whatever has arrived across current
 *         stakers. If nothing is staked when a reward lands, it stays unaccounted and
 *         is distributed to the first staker(s) thereafter.
 *
 *         `stakingToken` is the Horizen ZEN token (tZEN on testnet). Swap this pool's
 *         address into `vault.setFeeRecipients(...)` to activate the fee-share; point
 *         the vault at Horizen's canonical staking pool later with the same call.
 */
contract ZenStakingPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant ACC_PRECISION = 1e18;

    IERC20 public immutable stakingToken; // ZEN / tZEN
    IERC20 public immutable rewardToken;  // ptVAULT shares

    uint256 public totalStaked;
    uint256 public accRewardPerShare;     // scaled by ACC_PRECISION
    uint256 public accountedReward;       // rewardToken balance already folded into the accumulator

    mapping(address => uint256) public stakedOf;
    mapping(address => uint256) public rewardDebt;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 reward);

    error ZeroAmount();
    error InsufficientStake();
    error SameToken();

    constructor(IERC20 stakingToken_, IERC20 rewardToken_, address initialOwner) Ownable(initialOwner) {
        if (address(stakingToken_) == address(rewardToken_)) revert SameToken();
        stakingToken = stakingToken_;
        rewardToken = rewardToken_;
    }

    // ------------------------------------------------------------------
    // Accounting
    // ------------------------------------------------------------------

    /// @dev Fold any newly-arrived reward tokens into the accumulator.
    function _sync() internal {
        if (totalStaked == 0) return; // hold unaccounted reward until someone stakes
        uint256 bal = rewardToken.balanceOf(address(this));
        uint256 arrived = bal - accountedReward;
        if (arrived > 0) {
            accRewardPerShare += (arrived * ACC_PRECISION) / totalStaked;
            accountedReward = bal;
        }
    }

    function _pending(address user) internal view returns (uint256) {
        return (stakedOf[user] * accRewardPerShare) / ACC_PRECISION - rewardDebt[user];
    }

    function _payout(address user) internal {
        uint256 pending = _pending(user);
        if (pending > 0) {
            accountedReward -= pending;
            rewardToken.safeTransfer(user, pending);
            emit Claimed(user, pending);
        }
    }

    function _setDebt(address user) internal {
        rewardDebt[user] = (stakedOf[user] * accRewardPerShare) / ACC_PRECISION;
    }

    // ------------------------------------------------------------------
    // User actions
    // ------------------------------------------------------------------

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync();
        _payout(msg.sender);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        stakedOf[msg.sender] += amount;
        totalStaked += amount;
        _setDebt(msg.sender);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (stakedOf[msg.sender] < amount) revert InsufficientStake();
        _sync();
        _payout(msg.sender);
        stakedOf[msg.sender] -= amount;
        totalStaked -= amount;
        _setDebt(msg.sender);
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claim() external nonReentrant {
        _sync();
        _payout(msg.sender);
        _setDebt(msg.sender);
    }

    function exit() external nonReentrant {
        uint256 amount = stakedOf[msg.sender];
        _sync();
        _payout(msg.sender);
        if (amount > 0) {
            stakedOf[msg.sender] = 0;
            totalStaked -= amount;
            stakingToken.safeTransfer(msg.sender, amount);
            emit Unstaked(msg.sender, amount);
        }
        _setDebt(msg.sender);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Reward claimable by `user` right now (including reward not yet synced).
    function pendingReward(address user) external view returns (uint256) {
        uint256 acc = accRewardPerShare;
        if (totalStaked > 0) {
            uint256 arrived = rewardToken.balanceOf(address(this)) - accountedReward;
            acc += (arrived * ACC_PRECISION) / totalStaked;
        }
        return (stakedOf[user] * acc) / ACC_PRECISION - rewardDebt[user];
    }

    /// @notice Reward tokens sitting here that no staked position has earned yet
    ///         (arrived while totalStaked == 0). Distributed to the next staker(s).
    function unaccountedReward() external view returns (uint256) {
        return rewardToken.balanceOf(address(this)) - accountedReward;
    }

    // ------------------------------------------------------------------
    // Admin — rescue tokens sent here by mistake (never the staking or reward token)
    // ------------------------------------------------------------------
    function rescue(IERC20 token, address to, uint256 amount) external onlyOwner {
        require(token != stakingToken && token != rewardToken, "protected token");
        token.safeTransfer(to, amount);
    }
}
