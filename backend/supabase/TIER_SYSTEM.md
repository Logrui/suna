# User Tier/Plan Assignment in Supabase

## 📍 Location

**Table**: `public.credit_accounts`  
**Column**: `tier` (VARCHAR(50), default: `'free'`)

## 🗂️ Schema Structure

The user's tier/plan is stored in the `credit_accounts` table with these columns:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `tier` | VARCHAR(50) | `'free'` | Current active tier/plan |
| `scheduled_tier_change` | TEXT | NULL | Planned future tier change |
| `scheduled_tier_change_date` | TIMESTAMPTZ | NULL | When the tier change will occur |

## 🎯 Tier Values

Based on the migrations, these are the recognized tier values:

### Standard Tiers
- `'none'` - No active subscription
- `'free'` - Free tier (default)
- `'tier_2_20'` - $2/month plan (20 credits)
- `'tier_6_50'` - $6/month plan (50 credits)
- `'tier_25_200'` - $25/month plan (200 credits)

### Additional Metadata
The `credit_accounts` table also tracks:
- `plan_type`: `'monthly'`, `'yearly'`, or `'yearly_commitment'`
- `stripe_subscription_id`: Stripe subscription identifier
- `stripe_subscription_status`: `'active'`, `'past_due'`, `'canceled'`, etc.
- `revenuecat_subscription_id`: RevenueCat subscription identifier (for mobile)
- `billing_provider`: `'stripe'` or `'revenuecat'`

## 📊 Table Relationships

```
auth.users (1) ─── (1) basejump.accounts 
                            │
                            │ (user_id → account_id)
                            ↓
                   credit_accounts (stores tier)
                            │
                            ├─→ credit_ledger (transaction history)
                            ├─→ credit_grants (monthly grant tracking)
                            └─→ daily_refresh_tracking (daily credit tracking)
```

## 🔍 Key Migrations

### Initial Tier Column
**File**: `20250905103100_fix_credit_schema.sql`
```sql
ALTER TABLE credit_accounts 
ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'free';
```

### Plan Type Column
**File**: `20251122064725_plan_type.sql`
```sql
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'monthly' 
CHECK (plan_type IN ('monthly', 'yearly', 'yearly_commitment'));
```

### Billing Provider
**File**: `20251117060630_add_billing_provider.sql`
```sql
ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(50) 
CHECK (billing_provider IN ('stripe', 'revenuecat'));
```

## 🔧 How Tiers Are Assigned

### 1. **New User Registration**
When a user signs up, they're automatically assigned:
- `tier = 'free'`
- `plan_type = 'monthly'`

### 2. **Subscription Upgrade**
When a user purchases a subscription:
1. Webhook from Stripe/RevenueCat hits backend
2. Backend calls `grant_tier_credits()` function
3. Updates `credit_accounts.tier` to new tier value
4. Grants monthly credits based on tier

**Function**: `grant_tier_credits(p_user_id, p_amount, p_tier)`

### 3. **Tier Changes**
Tier changes can be:
- **Immediate**: Direct UPDATE to `tier` column
- **Scheduled**: Set `scheduled_tier_change` and `scheduled_tier_change_date`

### 4. **Subscription Renewal**
**File**: `20251122064823_yearly_plan_refill.sql`
- Cron job runs daily at 1 AM UTC
- Checks for yearly plans needing monthly credit refills
- Grants credits based on current `tier` value

## 🎓 Querying User Tiers

### Get User's Current Tier
```sql
SELECT tier, plan_type, stripe_subscription_status
FROM credit_accounts
WHERE account_id = 'user-uuid-here';
```

### Get All Active Subscriptions
```sql
SELECT account_id, tier, plan_type, balance, next_credit_grant
FROM credit_accounts
WHERE tier NOT IN ('none', 'free')
  AND stripe_subscription_status = 'active';
```

### Get Tier Distribution
```sql
SELECT 
    tier, 
    COUNT(*) as user_count,
    SUM(balance) as total_credits
FROM credit_accounts
GROUP BY tier
ORDER BY user_count DESC;
```

## 📝 Related Files

### Migration Files
- `20250905103100_fix_credit_schema.sql` - Initial tier column
- `20251122064725_plan_type.sql` - Plan type (monthly/yearly)
- `20251117060630_add_billing_provider.sql` - Billing provider tracking
- `20251122064823_yearly_plan_refill.sql` - Yearly plan credit refills
- `20251122073154_add_subscription_status_tracking.sql` - Subscription status

### Functions
- `grant_tier_credits()` - Grants credits and updates tier
- `process_monthly_refills()` - Handles yearly plan refills
- `atomic_grant_renewal_credits()` - Renewal credit processing

## 🚨 Important Notes

1. **No Enum Type**: Tier values are stored as VARCHAR, not an ENUM, allowing flexibility for new tiers

2. **Multiple Providers**: The system supports both:
   - Web subscriptions via Stripe
   - Mobile subscriptions via RevenueCat

3. **Account vs User ID**: 
   - Old migrations use `user_id`
   - Newer migrations use `account_id`
   - Migration `20250908082546` renamed the column

4. **Tier Determines Credits**: The tier value directly controls:
   - Monthly credit allocations
   - Daily credit refresh amounts
   - Feature access (via backend checks)

## 🔗 Additional Resources

- Billing migrations: `.\check-migrations.ps1 -Filter "billing"`
- Credit system: `.\check-migrations.ps1 -Filter "credit"`
- Query current tiers: `.\query-tiers.ps1`
