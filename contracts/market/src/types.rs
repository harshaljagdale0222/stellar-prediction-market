// SPDX-License-Identifier: MIT
//! Shared types, enums, and structured errors for the WTF Prediction Market (Soroban Rust).

use soroban_sdk::{contracterror, contracttype, Address, BytesN};

/// Binary outcome identifier for prediction events.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OutcomeId {
    Yes = 1,
    No = 2,
    Void = 3,
}

/// Operational state of a prediction market lifecycle.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MarketState {
    Active = 0,
    DisputeWindowOpen = 1,
    Resolved = 2,
    Voided = 3,
}

/// Market deployment and risk parameters.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketConfig {
    pub creator: Address,
    pub resolver: Address,
    pub alpha_bps: u32,             // Parameterized liquidity depth scalar (in basis points: 10,000 = 1.0x)
    pub created_at: u64,            // Creation unix timestamp
    pub resolution_deadline: u64,   // Expiry unix timestamp
    pub dispute_window_hours: u32,  // Dispute window duration in hours
    pub evidence_hash: BytesN<32>,  // Committed IPFS / resolver evidence hash
}

/// On-chain dispute and resolution tracking state.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeRecord {
    pub proposed_outcome: OutcomeId,
    pub resolver: Address,
    pub dispute_window_ends: u64,
    pub is_disputed: bool,
    pub disputer: Address,
    pub evidence_hash: BytesN<32>,
}

/// Comprehensive structured error codes.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    MarketNotActive = 1,
    ResolutionDeadlineNotPassed = 2,
    ResolutionDeadlineAlreadyPassed = 3,
    UnauthorizedResolver = 4,
    AlreadyResolved = 5,
    DisputeWindowNotExpired = 6,
    DisputeWindowExpired = 7,
    MarketAlreadyDisputed = 8,
    InsufficientLiquidity = 9,
    SlippageExceeded = 10,
    InvalidAlphaParameter = 11,
    InvalidDuration = 12,
    ZeroAmount = 13,
    InsufficientBalance = 14,
    ArithmeticOverflow = 15,
}
