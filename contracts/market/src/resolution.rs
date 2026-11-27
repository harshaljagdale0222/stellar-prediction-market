// SPDX-License-Identifier: MIT
//! WP5-B.2: On-chain market resolution lifecycle, dispute window state transitions,
//! oracle hook stubs, and proportional collateral settlement.

use soroban_sdk::{Address, BytesN, Env};
use crate::types::{DisputeRecord, Error, MarketConfig, MarketState, OutcomeId};
use crate::events;

/// Handles the `resolve` entry point invocation.
///
/// Callable only by the designated `resolver` address.
/// Checks that the market has reached `resolution_deadline` and is not already resolved.
/// Enters the `DisputeWindowOpen` state and schedules `dispute_window_ends`.
pub fn execute_resolve(
    env: &Env,
    market_id: Address,
    caller: Address,
    config: &MarketConfig,
    current_state: MarketState,
    outcome: OutcomeId,
    evidence_hash: BytesN<32>,
) -> Result<(MarketState, DisputeRecord), Error> {
    // 1. Authorization: caller must match designated resolver
    if caller != config.resolver {
        return Err(Error::UnauthorizedResolver);
    }

    // 2. State verification: cannot double-resolve
    if current_state != MarketState.Active {
        return Err(Error::AlreadyResolved);
    }

    // 3. Timing constraint: cannot resolve before deadline
    let now = env.ledger().timestamp();
    if now < config.resolution_deadline {
        return Err(Error::ResolutionDeadlineNotPassed);
    }

    // 4. Calculate dispute window expiration
    let dispute_duration_seconds = (config.dispute_window_hours as u64) * 3600;
    let dispute_window_ends = now + dispute_duration_seconds;

    let dispute_record = DisputeRecord {
        proposed_outcome: outcome,
        resolver: caller,
        dispute_window_ends,
        is_disputed: false,
        disputer: config.resolver.clone(), // initial dummy placeholder
        evidence_hash: evidence_hash.clone(),
    };

    // 5. Emit DisputeWindowOpen event
    events::emit_dispute_window_open(
        env,
        market_id.clone(),
        outcome,
        dispute_window_ends,
        now,
    );

    // If dispute window duration is 0, finalize resolution immediately
    if config.dispute_window_hours == 0 {
        events::emit_dispute_window_closed(env, market_id.clone(), outcome, now);
        events::emit_market_resolved(env, market_id, outcome, config.resolver.clone(), evidence_hash, now);
        return Ok((MarketState::Resolved, dispute_record));
    }

    Ok((MarketState::DisputeWindowOpen, dispute_record))
}

/// Finalizes a resolution after the dispute window has elapsed without challenge.
pub fn finalize_resolution(
    env: &Env,
    market_id: Address,
    config: &MarketConfig,
    dispute_record: &DisputeRecord,
) -> Result<MarketState, Error> {
    let now = env.ledger().timestamp();

    if now < dispute_record.dispute_window_ends {
        return Err(Error::DisputeWindowNotExpired);
    }

    if dispute_record.is_disputed {
        return Err(Error::MarketAlreadyDisputed);
    }

    // Emit final settlement events
    events::emit_dispute_window_closed(env, market_id.clone(), dispute_record.proposed_outcome, now);
    events::emit_market_resolved(
        env,
        market_id,
        dispute_record.proposed_outcome,
        config.resolver.clone(),
        dispute_record.evidence_hash.clone(),
        now,
    );

    Ok(MarketState::Resolved)
}

/// STUB: Dispute challenge hook.
/// Flagged clearly: actual multi-sig / UMA arbitration is a future workstream.
pub fn challenge_resolution_stub(
    env: &Env,
    _disputer: Address,
    dispute_record: &mut DisputeRecord,
    _evidence_ref: BytesN<32>,
) -> Result<(), Error> {
    let now = env.ledger().timestamp();
    if now >= dispute_record.dispute_window_ends {
        return Err(Error::DisputeWindowExpired);
    }
    if dispute_record.is_disputed {
        return Err(Error::MarketAlreadyDisputed);
    }

    // Flagged stub implementation
    dispute_record.is_disputed = true;

    // TODO: Connect to decentralized dispute resolution board / arbitration DAO
    Ok(())
}

/// Calculates proportional redemption payout for winning outcome token holders.
///
/// Winning tokens redeem 1:1 against backed collateral.
/// Losing tokens redeem for 0.
/// Residual unredeemed collateral is returned to liquidity providers.
pub fn calculate_redemption_payout(
    winning_outcome: OutcomeId,
    token_outcome: OutcomeId,
    token_balance: i128,
) -> Result<i128, Error> {
    if token_balance <= 0 {
        return Err(Error::ZeroAmount);
    }

    if winning_outcome == OutcomeId::Void {
        // Void market: pro-rata 50% refund on complete pairs
        return Ok(token_balance / 2);
    }

    if token_outcome == winning_outcome {
        // Winning outcome redeems 1:1 against collateral
        Ok(token_balance)
    } else {
        // Losing outcome settles to zero
        Ok(0)
    }
}
