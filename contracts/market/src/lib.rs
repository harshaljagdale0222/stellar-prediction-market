#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, vec, Address, Env, IntoVal, Symbol, token::{Client as TokenClient},
};

#[derive(Clone, PartialEq, Eq)]
#[contracttype]
pub enum MarketOutcome {
    Unresolved,
    Yes,
    No,
    Invalid,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Oracle,
    CollateralToken,
    YesToken,
    NoToken,
    LpToken,
    Outcome,
    Resolved,
    TotalShares,
}

#[contract]
pub struct PredictionMarket;

#[contractimpl]
impl PredictionMarket {
    pub fn init(
        e: Env,
        admin: Address,
        oracle: Address,
        collateral_token: Address,
        yes_token: Address,
        no_token: Address,
        lp_token: Address,
    ) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Oracle, &oracle);
        e.storage().instance().set(&DataKey::CollateralToken, &collateral_token);
        e.storage().instance().set(&DataKey::YesToken, &yes_token);
        e.storage().instance().set(&DataKey::NoToken, &no_token);
        e.storage().instance().set(&DataKey::LpToken, &lp_token);
        e.storage().instance().set(&DataKey::Outcome, &MarketOutcome::Unresolved);
        e.storage().instance().set(&DataKey::Resolved, &false);
    }

    pub fn add_liquidity(e: Env, from: Address, collateral_amount: i128) {
        from.require_auth();
        if collateral_amount <= 0 { panic!("amount must be positive"); }
        if Self::is_resolved(&e) { panic!("market already resolved"); }

        let collateral = TokenClient::new(&e, &Self::get_collateral(&e));
        let yes = TokenClient::new(&e, &Self::get_yes(&e));
        let no = TokenClient::new(&e, &Self::get_no(&e));
        let lp = TokenClient::new(&e, &Self::get_lp(&e));

        collateral.transfer(&from, &e.current_contract_address(), &collateral_amount);

        e.invoke_contract::<()>(&Self::get_yes(&e), &Symbol::new(&e, "mint"), vec![&e, e.current_contract_address().into_val(&e), collateral_amount.into_val(&e)]);
        e.invoke_contract::<()>(&Self::get_no(&e), &Symbol::new(&e, "mint"), vec![&e, e.current_contract_address().into_val(&e), collateral_amount.into_val(&e)]);

        let total_shares: i128 = e.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let pool_yes = yes.balance(&e.current_contract_address());
        
        let shares_to_mint = if total_shares == 0 {
            collateral_amount
        } else {
            let old_yes = pool_yes - collateral_amount;
            if old_yes == 0 {
                collateral_amount
            } else {
                (collateral_amount * total_shares) / old_yes
            }
        };

        e.invoke_contract::<()>(&Self::get_lp(&e), &Symbol::new(&e, "mint"), vec![&e, from.into_val(&e), shares_to_mint.into_val(&e)]);
        e.storage().instance().set(&DataKey::TotalShares, &(total_shares + shares_to_mint));
    }

    pub fn buy_yes(e: Env, from: Address, collateral_amount: i128, min_yes_out: i128) {
        from.require_auth();
        if collateral_amount <= 0 { panic!("amount must be positive"); }
        if Self::is_resolved(&e) { panic!("market already resolved"); }

        let collateral = TokenClient::new(&e, &Self::get_collateral(&e));
        let yes = TokenClient::new(&e, &Self::get_yes(&e));
        let no = TokenClient::new(&e, &Self::get_no(&e));

        collateral.transfer(&from, &e.current_contract_address(), &collateral_amount);

        e.invoke_contract::<()>(&Self::get_yes(&e), &Symbol::new(&e, "mint"), vec![&e, e.current_contract_address().into_val(&e), collateral_amount.into_val(&e)]);
        e.invoke_contract::<()>(&Self::get_no(&e), &Symbol::new(&e, "mint"), vec![&e, e.current_contract_address().into_val(&e), collateral_amount.into_val(&e)]);

        let r_yes = yes.balance(&e.current_contract_address()) - collateral_amount;
        let r_no = no.balance(&e.current_contract_address()) - collateral_amount;

        let amount_in_with_fee = (collateral_amount * 99) / 100;
        let numerator = r_yes * r_no;
        let denominator = r_no + amount_in_with_fee;
        let p_out_yes = r_yes - (numerator / denominator);

        let total_yes_to_user = collateral_amount + p_out_yes;
        if total_yes_to_user < min_yes_out {
            panic!("slippage exceeded");
        }

        yes.transfer(&e.current_contract_address(), &from, &total_yes_to_user);
    }

    pub fn buy_no(e: Env, from: Address, collateral_amount: i128, min_no_out: i128) {
        from.require_auth();
        if collateral_amount <= 0 { panic!("amount must be positive"); }
        if Self::is_resolved(&e) { panic!("market already resolved"); }

        let collateral = TokenClient::new(&e, &Self::get_collateral(&e));
        let yes = TokenClient::new(&e, &Self::get_yes(&e));
        let no = TokenClient::new(&e, &Self::get_no(&e));

        collateral.transfer(&from, &e.current_contract_address(), &collateral_amount);

        e.invoke_contract::<()>(&Self::get_yes(&e), &Symbol::new(&e, "mint"), vec![&e, e.current_contract_address().into_val(&e), collateral_amount.into_val(&e)]);
        e.invoke_contract::<()>(&Self::get_no(&e), &Symbol::new(&e, "mint"), vec![&e, e.current_contract_address().into_val(&e), collateral_amount.into_val(&e)]);

        let r_yes = yes.balance(&e.current_contract_address()) - collateral_amount;
        let r_no = no.balance(&e.current_contract_address()) - collateral_amount;

        let amount_in_with_fee = (collateral_amount * 99) / 100;
        let numerator = r_yes * r_no;
        let denominator = r_yes + amount_in_with_fee;
        let p_out_no = r_no - (numerator / denominator);

        let total_no_to_user = collateral_amount + p_out_no;
        if total_no_to_user < min_no_out {
            panic!("slippage exceeded");
        }

        no.transfer(&e.current_contract_address(), &from, &total_no_to_user);
    }

    pub fn sell_yes(e: Env, from: Address, collateral_out: i128, max_yes_in: i128) {
        from.require_auth();
        if collateral_out <= 0 { panic!("amount must be positive"); }
        if Self::is_resolved(&e) { panic!("market already resolved"); }

        let collateral = TokenClient::new(&e, &Self::get_collateral(&e));
        let yes = TokenClient::new(&e, &Self::get_yes(&e));
        let no = TokenClient::new(&e, &Self::get_no(&e));

        let r_yes = yes.balance(&e.current_contract_address());
        let r_no = no.balance(&e.current_contract_address());

        if collateral_out >= r_no {
            panic!("insufficient pool liquidity");
        }

        let numerator = r_yes * r_no;
        let denominator = r_no - collateral_out;
        let division_ceil = (numerator + denominator - 1) / denominator;
        let mut x_fee = division_ceil - r_yes;
        if x_fee < 0 { x_fee = 0; }
        
        let x = (x_fee * 100 + 98) / 99;
        let total_yes_in = x + collateral_out;
        if total_yes_in > max_yes_in {
            panic!("slippage exceeded");
        }

        yes.transfer(&from, &e.current_contract_address(), &total_yes_in);
        e.invoke_contract::<()>(&Self::get_yes(&e), &Symbol::new(&e, "admin_burn"), vec![&e, e.current_contract_address().into_val(&e), collateral_out.into_val(&e)]);
        e.invoke_contract::<()>(&Self::get_no(&e), &Symbol::new(&e, "admin_burn"), vec![&e, e.current_contract_address().into_val(&e), collateral_out.into_val(&e)]);
        collateral.transfer(&e.current_contract_address(), &from, &collateral_out);
    }

    pub fn claim_winnings(e: Env, from: Address) {
        from.require_auth();
        let is_resolved: bool = e.storage().instance().get(&DataKey::Resolved).unwrap();
        if !is_resolved {
            panic!("market not resolved yet");
        }

        let outcome: MarketOutcome = e.storage().instance().get(&DataKey::Outcome).unwrap();
        let collateral = TokenClient::new(&e, &Self::get_collateral(&e));
        let yes = TokenClient::new(&e, &Self::get_yes(&e));
        let no = TokenClient::new(&e, &Self::get_no(&e));

        let user_yes = yes.balance(&from);
        let user_no = no.balance(&from);
        let mut payout = 0;

        if outcome == MarketOutcome::Yes {
            payout = user_yes;
            if user_yes > 0 {
                e.invoke_contract::<()>(&Self::get_yes(&e), &Symbol::new(&e, "burn"), vec![&e, from.into_val(&e), user_yes.into_val(&e)]);
            }
        } else if outcome == MarketOutcome::No {
            payout = user_no;
            if user_no > 0 {
                e.invoke_contract::<()>(&Self::get_no(&e), &Symbol::new(&e, "burn"), vec![&e, from.into_val(&e), user_no.into_val(&e)]);
            }
        } else if outcome == MarketOutcome::Invalid {
            if user_yes > 0 {
                e.invoke_contract::<()>(&Self::get_yes(&e), &Symbol::new(&e, "burn"), vec![&e, from.into_val(&e), user_yes.into_val(&e)]);
            }
            if user_no > 0 {
                e.invoke_contract::<()>(&Self::get_no(&e), &Symbol::new(&e, "burn"), vec![&e, from.into_val(&e), user_no.into_val(&e)]);
            }
            payout = (user_yes + user_no) / 2;
        }

        if payout > 0 {
            collateral.transfer(&e.current_contract_address(), &from, &payout);
        }
    }

    pub fn resolve(e: Env, outcome: MarketOutcome) {
        let oracle: Address = e.storage().instance().get(&DataKey::Oracle).unwrap();
        oracle.require_auth();
        if Self::is_resolved(&e) { panic!("already resolved"); }
        e.storage().instance().set(&DataKey::Outcome, &outcome);
        e.storage().instance().set(&DataKey::Resolved, &true);
    }

    fn is_resolved(e: &Env) -> bool { e.storage().instance().get(&DataKey::Resolved).unwrap_or(false) }
    fn get_collateral(e: &Env) -> Address { e.storage().instance().get(&DataKey::CollateralToken).unwrap() }
    fn get_yes(e: &Env) -> Address { e.storage().instance().get(&DataKey::YesToken).unwrap() }
    fn get_no(e: &Env) -> Address { e.storage().instance().get(&DataKey::NoToken).unwrap() }
    fn get_lp(e: &Env) -> Address { e.storage().instance().get(&DataKey::LpToken).unwrap() }
}
