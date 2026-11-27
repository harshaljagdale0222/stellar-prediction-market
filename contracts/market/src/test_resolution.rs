// SPDX-License-Identifier: MIT
//! WP5-B.2: Integration test suite for on-chain resolution, resolver authorization,
//! dispute window state transitions, and proportional token redemptions.

use soroban_sdk::{testutils::{Address as _, Ledger}, Address, BytesN, Env};
use crate::resolution::*;
use crate::types::{DisputeRecord, Error, MarketConfig, MarketState, OutcomeId};

fn setup_test_config(env: &Env, resolver: &Address, deadline: u64, dispute_hours: u32) -> MarketConfig {
    MarketConfig {
        creator: Address::generate(env),
        resolver: resolver.clone(),
        alpha_bps: 10_000,
        created_at: 1_000_000,
        resolution_deadline: deadline,
        dispute_window_hours: dispute_hours,
        evidence_hash: BytesN::from_array(env, &[1u8; 32]),
    }
}

#[test]
fn test_normal_resolution_and_finalization() {
    let env = Env::default();
    let resolver = Address::generate(&env);
    let market_id = Address::generate(&env);
    let deadline: u64 = 1_100_000;
    let dispute_hours: u32 = 24;

    let config = setup_test_config(&env, &resolver, deadline, dispute_hours);
    let evidence = BytesN::from_array(&env, &[0x42u8; 32]);

    // 1. Advance ledger time past resolution deadline
    env.ledger().set_timestamp(deadline + 100);

    // 2. Execute resolution by authorized resolver
    let (next_state, record) = execute_resolve(
        &env,
        market_id.clone(),
        resolver.clone(),
        &config,
        MarketState::Active,
        OutcomeId::Yes,
        evidence.clone(),
    ).expect("Resolution should succeed");

    assert_eq!(next_state, MarketState::DisputeWindowOpen);
    assert_eq!(record.proposed_outcome, OutcomeId::Yes);
    assert_eq!(record.resolver, resolver);
    assert_eq!(record.evidence_hash, evidence);
    assert!(!record.is_disputed);
    assert_eq!(record.dispute_window_ends, deadline + 100 + 24 * 3600);

    // 3. Attempting to finalize before dispute window expires must fail
    let premature_finalize = finalize_resolution(&env, market_id.clone(), &config, &record);
    assert_eq!(premature_finalize.err(), Some(Error::DisputeWindowNotExpired));

    // 4. Advance ledger past dispute window
    env.ledger().set_timestamp(record.dispute_window_ends + 1);

    // 5. Finalize resolution
    let final_state = finalize_resolution(&env, market_id, &config, &record)
        .expect("Finalization after dispute window should succeed");
    assert_eq!(final_state, MarketState::Resolved);
}

#[test]
fn test_instant_resolution_when_dispute_window_zero() {
    let env = Env::default();
    let resolver = Address::generate(&env);
    let market_id = Address::generate(&env);
    let deadline: u64 = 1_100_000;

    // Zero-hour dispute window
    let config = setup_test_config(&env, &resolver, deadline, 0);
    let evidence = BytesN::from_array(&env, &[7u8; 32]);

    env.ledger().set_timestamp(deadline + 10);

    let (next_state, _) = execute_resolve(
        &env,
        market_id,
        resolver,
        &config,
        MarketState::Active,
        OutcomeId::No,
        evidence,
    ).expect("Instant resolution should succeed");

    // Instantly resolves when dispute_window_hours == 0
    assert_eq!(next_state, MarketState::Resolved);
}

#[test]
fn test_resolution_authorization_failure() {
    let env = Env::default();
    let resolver = Address::generate(&env);
    let attacker = Address::generate(&env);
    let market_id = Address::generate(&env);
    let deadline: u64 = 1_100_000;

    let config = setup_test_config(&env, &resolver, deadline, 24);
    let evidence = BytesN::from_array(&env, &[0u8; 32]);

    env.ledger().set_timestamp(deadline + 10);

    // Attempted resolve by unauthorized caller -> UnauthorizedResolver
    let result = execute_resolve(
        &env,
        market_id,
        attacker,
        &config,
        MarketState::Active,
        OutcomeId::Yes,
        evidence,
    );

    assert_eq!(result.err(), Some(Error::UnauthorizedResolver));
}

#[test]
fn test_premature_resolution_rejection() {
    let env = Env::default();
    let resolver = Address::generate(&env);
    let market_id = Address::generate(&env);
    let deadline: u64 = 1_100_000;

    let config = setup_test_config(&env, &resolver, deadline, 24);
    let evidence = BytesN::from_array(&env, &[0u8; 32]);

    // Current time is before deadline (deadline - 100)
    env.ledger().set_timestamp(deadline - 100);

    let result = execute_resolve(
        &env,
        market_id,
        resolver,
        &config,
        MarketState::Active,
        OutcomeId::Yes,
        evidence,
    );

    assert_eq!(result.err(), Some(Error::ResolutionDeadlineNotPassed));
}

#[test]
fn test_double_resolution_rejection() {
    let env = Env::default();
    let resolver = Address::generate(&env);
    let market_id = Address::generate(&env);
    let deadline: u64 = 1_100_000;

    let config = setup_test_config(&env, &resolver, deadline, 24);
    let evidence = BytesN::from_array(&env, &[0u8; 32]);

    env.ledger().set_timestamp(deadline + 10);

    // Attempting to resolve when market is already in DisputeWindowOpen or Resolved -> AlreadyResolved
    let result_dispute = execute_resolve(
        &env,
        market_id.clone(),
        resolver.clone(),
        &config,
        MarketState::DisputeWindowOpen,
        OutcomeId::Yes,
        evidence.clone(),
    );
    assert_eq!(result_dispute.err(), Some(Error::AlreadyResolved));

    let result_resolved = execute_resolve(
        &env,
        market_id,
        resolver,
        &config,
        MarketState::Resolved,
        OutcomeId::Yes,
        evidence,
    );
    assert_eq!(result_resolved.err(), Some(Error::AlreadyResolved));
}

#[test]
fn test_dispute_challenge_stub_lifecycle() {
    let env = Env::default();
    let resolver = Address::generate(&env);
    let disputer = Address::generate(&env);
    let deadline: u64 = 1_100_000;

    let mut record = DisputeRecord {
        proposed_outcome: OutcomeId::Yes,
        resolver: resolver.clone(),
        dispute_window_ends: deadline + 86400,
        is_disputed: false,
        disputer: resolver.clone(),
        evidence_hash: BytesN::from_array(&env, &[0u8; 32]),
    };

    env.ledger().set_timestamp(deadline + 1000);

    // Dispute challenge succeeds within window
    let res = challenge_resolution_stub(
        &env,
        disputer.clone(),
        &mut record,
        BytesN::from_array(&env, &[9u8; 32]),
    );
    assert!(res.is_ok());
    assert!(record.is_disputed);

    // Second dispute attempt fails -> MarketAlreadyDisputed
    let second_res = challenge_resolution_stub(
        &env,
        disputer,
        &mut record,
        BytesN::from_array(&env, &[9u8; 32]),
    );
    assert_eq!(second_res.err(), Some(Error::MarketAlreadyDisputed));
}

#[test]
fn test_proportional_redemption_calculations() {
    let winning_outcome = OutcomeId::Yes;
    let losing_outcome = OutcomeId::No;
    let user_balance: i128 = 5_000_000_000; // 500 outcome tokens

    // 1. Winning outcome token redemptions pay out 1:1 against backed collateral
    let win_payout = calculate_redemption_payout(winning_outcome, winning_outcome, user_balance).unwrap();
    assert_eq!(win_payout, user_balance);

    // 2. Losing outcome tokens redeem for zero
    let lose_payout = calculate_redemption_payout(winning_outcome, losing_outcome, user_balance).unwrap();
    assert_eq!(lose_payout, 0);

    // 3. Void market outcome: pays 50% pro-rata refund
    let void_payout = calculate_redemption_payout(OutcomeId::Void, winning_outcome, user_balance).unwrap();
    assert_eq!(void_payout, user_balance / 2);

    // 4. Zero balance redemption attempt -> ZeroAmount
    let zero_payout = calculate_redemption_payout(winning_outcome, winning_outcome, 0);
    assert_eq!(zero_payout.err(), Some(Error::ZeroAmount));

    // 5. Negative balance redemption attempt -> ZeroAmount
    let neg_payout = calculate_redemption_payout(winning_outcome, winning_outcome, -100);
    assert_eq!(neg_payout.err(), Some(Error::ZeroAmount));
}
