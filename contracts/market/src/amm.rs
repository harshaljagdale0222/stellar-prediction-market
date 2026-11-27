// SPDX-License-Identifier: MIT
//! WP5-B.1: Calibrated AMM module with parameterised liquidity depth scalar (alpha)
//! and time-decay curve. Pure mathematical pricing logic with no I/O.

use crate::types::Error;

/// Basis points precision denominator (10,000 = 100.00% = 1.0x).
pub const BPS_SCALE: u128 = 10_000;

/// Standard AMM trading fee: 30 BPS (0.30%).
pub const TRADING_FEE_BPS: u128 = 30;

/// Minimum allowable alpha parameter: 1,000 BPS (0.10x depth).
pub const MIN_ALPHA_BPS: u32 = 1_000;

/// Maximum allowable alpha parameter: 500,000 BPS (50.00x depth).
pub const MAX_ALPHA_BPS: u32 = 500_000;

/// Floor for time-decay dampening factor: 2,000 BPS (20.00% of initial depth).
/// This prevents liquidity from dropping to zero at the deadline while ensuring
/// a 5x widening of price impact for last-second orders.
pub const MIN_DECAY_FLOOR_BPS: u128 = 2_000;

/// Struct containing detailed trade quote results.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TradeQuote {
    pub tokens_out: u128,
    pub fee_amount: u128,
    pub price_impact_bps: u128,
    pub spot_price_before_bps: u128,
    pub spot_price_after_bps: u128,
    pub effective_alpha_bps: u128,
    pub decay_factor_bps: u128,
}

/// Pure time-decay curve calculation.
///
/// Returns the decay factor in basis points (2,000 to 10,000).
/// As `current_time` approaches `resolution_deadline`, the decay factor decreases linearly
/// towards `MIN_DECAY_FLOOR_BPS`, which in turn shrinks effective depth and widens price impact.
pub fn calculate_time_decay_factor(
    created_at: u64,
    resolution_deadline: u64,
    current_time: u64,
) -> Result<u128, Error> {
    if resolution_deadline <= created_at {
        return Err(Error::InvalidDuration);
    }

    // Trade occurred at or after resolution deadline: capped at minimum decay floor.
    if current_time >= resolution_deadline {
        return Ok(MIN_DECAY_FLOOR_BPS);
    }

    // Trade occurred at or before creation time: 100% initial depth factor.
    if current_time <= created_at {
        return Ok(BPS_SCALE);
    }

    let time_remaining = (resolution_deadline - current_time) as u128;
    let total_duration = (resolution_deadline - created_at) as u128;

    // Linear decay interpolation:
    // decay = MIN_DECAY_FLOOR + (BPS_SCALE - MIN_DECAY_FLOOR) * (time_remaining / total_duration)
    let decay_range = BPS_SCALE - MIN_DECAY_FLOOR_BPS;
    let decay_factor = MIN_DECAY_FLOOR_BPS + (decay_range * time_remaining) / total_duration;

    Ok(decay_factor)
}

/// Calculates the effective alpha parameter (depth scalar) after time-decay dampening.
pub fn calculate_effective_alpha(
    alpha_bps: u32,
    decay_factor_bps: u128,
) -> Result<u128, Error> {
    if alpha_bps < MIN_ALPHA_BPS || alpha_bps > MAX_ALPHA_BPS {
        return Err(Error::InvalidAlphaParameter);
    }

    let raw_effective = ((alpha_bps as u128) * decay_factor_bps) / BPS_SCALE;
    // Safety check: guarantee at least 1 BPS effective
    let effective = if raw_effective == 0 { 1 } else { raw_effective };

    Ok(effective)
}

/// Computes virtual depth-adjusted effective reserves.
///
/// Returns `(effective_yes, effective_no, effective_k)`.
pub fn calculate_effective_reserves(
    yes_reserve: u128,
    no_reserve: u128,
    effective_alpha_bps: u128,
) -> Result<(u128, u128, u128), Error> {
    if yes_reserve == 0 || no_reserve == 0 {
        return Err(Error::InsufficientLiquidity);
    }

    let yes_eff = (yes_reserve * effective_alpha_bps) / BPS_SCALE;
    let no_eff = (no_reserve * effective_alpha_bps) / BPS_SCALE;

    if yes_eff == 0 || no_eff == 0 {
        return Err(Error::InsufficientLiquidity);
    }

    let k_eff = match yes_eff.checked_mul(no_eff) {
        Some(k) => k,
        None => return Err(Error::ArithmeticOverflow),
    };

    Ok((yes_eff, no_eff, k_eff))
}

/// Returns the normalized spot prices in basis points (sum to 10,000).
/// Spot price of YES is proportional to the NO reserve: P(YES) = no / (yes + no).
pub fn calculate_spot_prices(yes_reserve: u128, no_reserve: u128) -> (u128, u128) {
    let total = yes_reserve + no_reserve;
    if total == 0 {
        return (5_000, 5_000);
    }

    let yes_price = (no_reserve * BPS_SCALE) / total;
    let no_price = BPS_SCALE - yes_price;

    (yes_price, no_price)
}

/// Pure pricing function: calculates output tokens, fee, and price impact for buying outcome tokens.
pub fn calculate_buy_quote(
    is_yes: bool,
    collateral_in: u128,
    yes_reserve: u128,
    no_reserve: u128,
    alpha_bps: u32,
    created_at: u64,
    resolution_deadline: u64,
    current_time: u64,
) -> Result<TradeQuote, Error> {
    if collateral_in == 0 {
        return Err(Error::ZeroAmount);
    }

    // 1. Calculate time decay factor and effective alpha
    let decay_factor_bps = calculate_time_decay_factor(created_at, resolution_deadline, current_time)?;
    let effective_alpha_bps = calculate_effective_alpha(alpha_bps, decay_factor_bps)?;

    // 2. Compute effective depth-adjusted reserves
    let (yes_eff, no_eff, k_eff) = calculate_effective_reserves(yes_reserve, no_reserve, effective_alpha_bps)?;

    // 3. Subtract 0.3% trading fee
    let fee_amount = (collateral_in * TRADING_FEE_BPS) / BPS_SCALE;
    let net_in = collateral_in - fee_amount;
    if net_in == 0 {
        return Err(Error::ZeroAmount);
    }

    // 4. Spot price before swap
    let (spot_yes_before, spot_no_before) = calculate_spot_prices(yes_eff, no_eff);
    let spot_before = if is_yes { spot_yes_before } else { spot_no_before };

    // 5. Constant-product AMM calculation:
    // Buying YES consumes YES tokens from pool, increases opposite (NO) inventory.
    let (selected_eff, opposite_eff) = if is_yes {
        (yes_eff, no_eff)
    } else {
        (no_eff, yes_eff)
    };

    let new_opposite = match opposite_eff.checked_add(net_in) {
        Some(v) => v,
        None => return Err(Error::ArithmeticOverflow),
    };

    // Ceiling division to preserve k invariant and inventory backing
    let ending_selected = (k_eff + new_opposite - 1) / new_opposite;

    if selected_eff + net_in <= ending_selected {
        return Err(Error::InsufficientLiquidity);
    }

    let tokens_out = selected_eff + net_in - ending_selected;
    if tokens_out == 0 {
        return Err(Error::ZeroAmount);
    }

    // 6. Spot price after swap
    let new_selected = selected_eff + net_in - tokens_out;
    let (spot_yes_after, spot_no_after) = if is_yes {
        calculate_spot_prices(new_selected, new_opposite)
    } else {
        calculate_spot_prices(new_opposite, new_selected)
    };
    let spot_after = if is_yes { spot_yes_after } else { spot_no_after };

    // 7. Price impact in basis points
    let price_impact_bps = if spot_before > 0 && spot_after > spot_before {
        ((spot_after - spot_before) * BPS_SCALE) / spot_before
    } else {
        0
    };

    Ok(TradeQuote {
        tokens_out,
        fee_amount,
        price_impact_bps,
        spot_price_before_bps: spot_before,
        spot_price_after_bps: spot_after,
        effective_alpha_bps,
        decay_factor_bps,
    })
}

/// Pure pricing function: calculates collateral payout and price impact for selling outcome tokens.
pub fn calculate_sell_quote(
    is_yes: bool,
    tokens_in: u128,
    yes_reserve: u128,
    no_reserve: u128,
    alpha_bps: u32,
    created_at: u64,
    resolution_deadline: u64,
    current_time: u64,
) -> Result<TradeQuote, Error> {
    if tokens_in == 0 {
        return Err(Error::ZeroAmount);
    }

    let decay_factor_bps = calculate_time_decay_factor(created_at, resolution_deadline, current_time)?;
    let effective_alpha_bps = calculate_effective_alpha(alpha_bps, decay_factor_bps)?;
    let (yes_eff, no_eff, _k_eff) = calculate_effective_reserves(yes_reserve, no_reserve, effective_alpha_bps)?;

    let (spot_yes_before, spot_no_before) = calculate_spot_prices(yes_eff, no_eff);
    let spot_before = if is_yes { spot_yes_before } else { spot_no_before };

    let opposite_eff = if is_yes { no_eff } else { yes_eff };
    let sum = yes_eff + no_eff + tokens_in;

    // Quadratic equation root: sum^2 - 4 * tokens_in * opposite_eff
    let discriminant = match sum.checked_mul(sum) {
        Some(s2) => {
            let subtrahend = 4 * tokens_in * opposite_eff;
            if s2 < subtrahend {
                return Err(Error::InsufficientLiquidity);
            }
            s2 - subtrahend
        }
        None => return Err(Error::ArithmeticOverflow),
    };

    // Integer square root
    let root = integer_sqrt(discriminant);
    let gross_collateral = (sum - root) / 2;

    if gross_collateral == 0 {
        return Err(Error::ZeroAmount);
    }

    let fee_amount = (gross_collateral * TRADING_FEE_BPS) / BPS_SCALE;
    let net_collateral_out = gross_collateral - fee_amount;

    let (spot_yes_after, spot_no_after) = if is_yes {
        calculate_spot_prices(yes_eff + tokens_in - gross_collateral, opposite_eff - gross_collateral)
    } else {
        calculate_spot_prices(opposite_eff - gross_collateral, no_eff + tokens_in - gross_collateral)
    };
    let spot_after = if is_yes { spot_yes_after } else { spot_no_after };

    let price_impact_bps = if spot_before > 0 && spot_before > spot_after {
        ((spot_before - spot_after) * BPS_SCALE) / spot_before
    } else {
        0
    };

    Ok(TradeQuote {
        tokens_out: net_collateral_out,
        fee_amount,
        price_impact_bps,
        spot_price_before_bps: spot_before,
        spot_price_after_bps: spot_after,
        effective_alpha_bps,
        decay_factor_bps,
    })
}

/// Helper: Newton-Raphson integer square root for u128.
fn integer_sqrt(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}
