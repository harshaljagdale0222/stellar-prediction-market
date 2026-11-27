// SPDX-License-Identifier: MIT
//! WP5-B.2 & WP5-B.3: Canonical Soroban event emitters with structured topics and typed payloads.

use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol};
use crate::types::OutcomeId;

pub fn emit_market_created(
    env: &Env,
    market_id: Address,
    creator: Address,
    resolver: Address,
    alpha_bps: u32,
    resolution_deadline: u64,
    dispute_window_hours: u32,
) {
    let topics = (symbol_short!("market"), symbol_short!("created"), market_id);
    let data = (creator, resolver, alpha_bps, resolution_deadline, dispute_window_hours);
    env.events().publish(topics, data);
}

pub fn emit_trade_placed(
    env: &Env,
    market_id: Address,
    trader: Address,
    is_yes: bool,
    collateral_in: i128,
    tokens_out: i128,
    price_impact_bps: u32,
    timestamp: u64,
) {
    let topics = (symbol_short!("trade"), symbol_short!("placed"), market_id);
    let data = (trader, is_yes, collateral_in, tokens_out, price_impact_bps, timestamp);
    env.events().publish(topics, data);
}

pub fn emit_liquidity_added(
    env: &Env,
    market_id: Address,
    provider: Address,
    collateral_amount: i128,
    lp_shares_minted: i128,
    timestamp: u64,
) {
    let topics = (symbol_short!("liquid"), symbol_short!("added"), market_id);
    let data = (provider, collateral_amount, lp_shares_minted, timestamp);
    env.events().publish(topics, data);
}

pub fn emit_dispute_window_open(
    env: &Env,
    market_id: Address,
    proposed_outcome: OutcomeId,
    dispute_deadline: u64,
    timestamp: u64,
) {
    let topics = (symbol_short!("dispute"), symbol_short!("opened"), market_id);
    let data = (proposed_outcome, dispute_deadline, timestamp);
    env.events().publish(topics, data);
}

pub fn emit_dispute_window_closed(
    env: &Env,
    market_id: Address,
    final_outcome: OutcomeId,
    timestamp: u64,
) {
    let topics = (symbol_short!("dispute"), symbol_short!("closed"), market_id);
    let data = (final_outcome, timestamp);
    env.events().publish(topics, data);
}

pub fn emit_market_resolved(
    env: &Env,
    market_id: Address,
    outcome: OutcomeId,
    resolver: Address,
    evidence_hash: BytesN<32>,
    timestamp: u64,
) {
    let topics = (symbol_short!("market"), symbol_short!("resolved"), market_id);
    let data = (outcome, resolver, evidence_hash, timestamp);
    env.events().publish(topics, data);
}
