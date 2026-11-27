// SPDX-License-Identifier: MIT
//! WP5-B.1: Unit test suite for calibrated AMM module with depth scalar (alpha)
//! and time-decay curve. Target: >= 95% branch coverage with all error conditions.

use crate::amm::*;
use crate::types::Error;

#[test]
fn test_alpha_bounds_validation() {
    // 1. Minimum bound: exactly 1,000 BPS (0.10x)
    let min_alpha = calculate_effective_alpha(MIN_ALPHA_BPS, BPS_SCALE);
    assert!(min_alpha.is_ok());
    assert_eq!(min_alpha.unwrap(), MIN_ALPHA_BPS as u128);

    // 2. Maximum bound: exactly 500,000 BPS (50.00x)
    let max_alpha = calculate_effective_alpha(MAX_ALPHA_BPS, BPS_SCALE);
    assert!(max_alpha.is_ok());
    assert_eq!(max_alpha.unwrap(), MAX_ALPHA_BPS as u128);

    // 3. Normal 1.0x baseline: 10,000 BPS
    let normal_alpha = calculate_effective_alpha(10_000, BPS_SCALE);
    assert!(normal_alpha.is_ok());
    assert_eq!(normal_alpha.unwrap(), 10_000);

    // 4. Invalid low: 999 BPS (below MIN_ALPHA_BPS) -> InvalidAlphaParameter
    let low_alpha = calculate_effective_alpha(999, BPS_SCALE);
    assert_eq!(low_alpha.err(), Some(Error::InvalidAlphaParameter));

    // 5. Invalid zero: 0 BPS -> InvalidAlphaParameter
    let zero_alpha = calculate_effective_alpha(0, BPS_SCALE);
    assert_eq!(zero_alpha.err(), Some(Error::InvalidAlphaParameter));

    // 6. Invalid high: 500,001 BPS (above MAX_ALPHA_BPS) -> InvalidAlphaParameter
    let high_alpha = calculate_effective_alpha(500_001, BPS_SCALE);
    assert_eq!(high_alpha.err(), Some(Error::InvalidAlphaParameter));
}

#[test]
fn test_time_decay_curve_progression() {
    let created_at: u64 = 1_000_000;
    let deadline: u64 = 1_000_000 + 7 * 86400; // 7 days later: 1,604,800
    let total_duration = deadline - created_at; // 604,800 seconds

    // 1. Invalid duration: deadline <= created_at
    assert_eq!(
        calculate_time_decay_factor(created_at, created_at, created_at).err(),
        Some(Error::InvalidDuration)
    );
    assert_eq!(
        calculate_time_decay_factor(deadline, created_at, created_at).err(),
        Some(Error::InvalidDuration)
    );

    // 2. At creation time (t = created_at): factor is 10,000 BPS (1.0x initial depth)
    let decay_at_start = calculate_time_decay_factor(created_at, deadline, created_at).unwrap();
    assert_eq!(decay_at_start, BPS_SCALE);

    // 3. Before creation time (t < created_at): clamped at 10,000 BPS
    let decay_before = calculate_time_decay_factor(created_at, deadline, created_at - 100).unwrap();
    assert_eq!(decay_before, BPS_SCALE);

    // 4. At midpoint (t = created_at + duration / 2):
    // Floor = 2,000; Range = 8,000; Midpoint = 2,000 + 4,000 = 6,000 BPS
    let midpoint = created_at + total_duration / 2;
    let decay_mid = calculate_time_decay_factor(created_at, deadline, midpoint).unwrap();
    assert_eq!(decay_mid, 6_000);

    // 5. At 75% elapsed (t = created_at + 3 * duration / 4):
    // Floor = 2,000 + 8,000 * 0.25 = 4,000 BPS
    let three_quarters = created_at + (3 * total_duration) / 4;
    let decay_75 = calculate_time_decay_factor(created_at, deadline, three_quarters).unwrap();
    assert_eq!(decay_75, 4_000);

    // 6. At deadline (t = deadline): minimum decay floor 2,000 BPS (0.20x depth)
    let decay_at_deadline = calculate_time_decay_factor(created_at, deadline, deadline).unwrap();
    assert_eq!(decay_at_deadline, MIN_DECAY_FLOOR_BPS);

    // 7. After deadline (t > deadline): capped at floor 2,000 BPS
    let decay_after = calculate_time_decay_factor(created_at, deadline, deadline + 500).unwrap();
    assert_eq!(decay_after, MIN_DECAY_FLOOR_BPS);
}

#[test]
fn test_widening_price_impact_near_deadline() {
    let created_at: u64 = 1_000_000;
    let deadline: u64 = 1_000_000 + 86400 * 7; // 7 days
    let alpha_bps: u32 = 10_000; // 1.0x baseline

    let yes_reserve: u128 = 100_000_000_000; // 10,000 tokens
    let no_reserve: u128 = 100_000_000_000;  // 10,000 tokens
    let trade_amount: u128 = 5_000_000_000;   // 500 tokens

    // Early trade (at market inception)
    let quote_early = calculate_buy_quote(
        true,
        trade_amount,
        yes_reserve,
        no_reserve,
        alpha_bps,
        created_at,
        deadline,
        created_at,
    ).unwrap();

    // Late trade (near resolution deadline: 99% elapsed)
    let late_time = created_at + (86400 * 7 * 99) / 100;
    let quote_late = calculate_buy_quote(
        true,
        trade_amount,
        yes_reserve,
        no_reserve,
        alpha_bps,
        created_at,
        deadline,
        late_time,
    ).unwrap();

    // Verify widening price impact:
    // As resolution approaches, effective depth shrinks to ~20%, causing price impact to widen ~5x.
    assert!(quote_late.price_impact_bps > quote_early.price_impact_bps);
    let impact_ratio = quote_late.price_impact_bps / quote_early.price_impact_bps;
    assert!(impact_ratio >= 4, "Price impact should widen by at least 4-5x near expiry");

    // Furthermore, trader receives fewer tokens out due to widened slippage
    assert!(quote_late.tokens_out < quote_early.tokens_out);
}

#[test]
fn test_spot_prices_calculation() {
    // 50-50 symmetric pool
    let (p_yes, p_no) = calculate_spot_prices(50_000, 50_000);
    assert_eq!(p_yes, 5_000);
    assert_eq!(p_no, 5_000);
    assert_eq!(p_yes + p_no, BPS_SCALE);

    // 80-20 skewed pool (YES is heavy in demand, so YES reserve is low, NO reserve is high)
    // P(YES) = no / (yes + no) = 80,000 / 100,000 = 80% = 8,000 BPS
    let (p_yes_skew, p_no_skew) = calculate_spot_prices(20_000, 80_000);
    assert_eq!(p_yes_skew, 8_000);
    assert_eq!(p_no_skew, 2_000);
    assert_eq!(p_yes_skew + p_no_skew, BPS_SCALE);

    // Zero reserve safety fallback
    let (p_zero_yes, p_zero_no) = calculate_spot_prices(0, 0);
    assert_eq!(p_zero_yes, 5_000);
    assert_eq!(p_zero_no, 5_000);
}

#[test]
fn test_buy_quote_yes_and_no_symmetry() {
    let created_at: u64 = 1_000_000;
    let deadline: u64 = created_at + 86400 * 14;
    let alpha_bps: u32 = 10_000;
    let reserve: u128 = 50_000_000_000;
    let collateral_in: u128 = 1_000_000_000; // 100 tokens

    let quote_yes = calculate_buy_quote(
        true,
        collateral_in,
        reserve,
        reserve,
        alpha_bps,
        created_at,
        deadline,
        created_at,
    ).unwrap();

    let quote_no = calculate_buy_quote(
        false,
        collateral_in,
        reserve,
        reserve,
        alpha_bps,
        created_at,
        deadline,
        created_at,
    ).unwrap();

    // In a balanced 50:50 pool, buying YES or NO for equal amounts must yield identical tokens out
    assert_eq!(quote_yes.tokens_out, quote_no.tokens_out);
    assert_eq!(quote_yes.fee_amount, quote_no.fee_amount);
    assert_eq!(quote_yes.price_impact_bps, quote_no.price_impact_bps);
    assert_eq!(quote_yes.fee_amount, (collateral_in * 30) / 10_000); // 0.30% fee
}

#[test]
fn test_sell_quote_execution() {
    let created_at: u64 = 1_000_000;
    let deadline: u64 = created_at + 86400 * 30;
    let alpha_bps: u32 = 15_000; // 1.5x depth
    let reserve: u128 = 100_000_000_000;
    let tokens_in: u128 = 2_000_000_000;

    let sell_quote = calculate_sell_quote(
        true,
        tokens_in,
        reserve,
        reserve,
        alpha_bps,
        created_at,
        deadline,
        created_at,
    ).unwrap();

    assert!(sell_quote.tokens_out > 0);
    assert!(sell_quote.tokens_out < tokens_in); // due to spread and 0.3% fee
    assert!(sell_quote.fee_amount > 0);
    assert!(sell_quote.spot_price_after_bps < sell_quote.spot_price_before_bps);
}

#[test]
fn test_pricing_sad_paths_and_errors() {
    let created_at: u64 = 1_000_000;
    let deadline: u64 = created_at + 86400 * 7;
    let alpha_bps: u32 = 10_000;

    // 1. Zero collateral input -> ZeroAmount
    assert_eq!(
        calculate_buy_quote(true, 0, 10_000, 10_000, alpha_bps, created_at, deadline, created_at).err(),
        Some(Error::ZeroAmount)
    );

    // 2. Zero tokens input on sell -> ZeroAmount
    assert_eq!(
        calculate_sell_quote(true, 0, 10_000, 10_000, alpha_bps, created_at, deadline, created_at).err(),
        Some(Error::ZeroAmount)
    );

    // 3. Zero liquidity in pool -> InsufficientLiquidity
    assert_eq!(
        calculate_buy_quote(true, 1_000, 0, 10_000, alpha_bps, created_at, deadline, created_at).err(),
        Some(Error::InsufficientLiquidity)
    );
    assert_eq!(
        calculate_buy_quote(true, 1_000, 10_000, 0, alpha_bps, created_at, deadline, created_at).err(),
        Some(Error::InsufficientLiquidity)
    );

    // 4. Invalid alpha parameter
    assert_eq!(
        calculate_buy_quote(true, 1_000, 10_000, 10_000, 500, created_at, deadline, created_at).err(),
        Some(Error::InvalidAlphaParameter)
    );

    // 5. Invalid duration (deadline <= created_at)
    assert_eq!(
        calculate_buy_quote(true, 1_000, 10_000, 10_000, alpha_bps, deadline, created_at, created_at).err(),
        Some(Error::InvalidDuration)
    );
}
