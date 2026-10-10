declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    VENICE_API_KEY?: string;
    VENICE_MODEL?: string;
    VENICE_BASE_URL?: string;
    CALYPTO_TOKEN_ADDRESS?: string;
    RH_RPC_URL?: string;
    ALCHEMY_API_KEY?: string;
    BLOCKSCOUT_API_KEY?: string;
    EXPLORER_URL?: string;
    DEXSCREENER_CHAIN_ID?: string;
    DAILY_REQUEST_LIMIT?: string;
    /** Temporarily bypass the three-prompt trial and holder gate when set to true. */
    DISABLE_TRIAL_LIMIT?: string;
    /** Minimum USD liquidity a DEX pair needs before its price is trusted. Default 50000. */
    MIN_LIQUIDITY_USD?: string;
    /** Fail closed when the 1h price move exceeds this percentage. Default 25. */
    MAX_PRICE_MOVE_H1_PCT?: string;
    /** Wallet must have held the bag this many seconds ago too. Default 3600; 0 disables. */
    HOLD_LOOKBACK_SECONDS?: string;
    /** Total characters of conversation sent to the model per prompt. Default 24000. */
    MAX_INPUT_CHARS?: string;
    /** Secret for signing assistant replies. Falls back to a key derived from VENICE_API_KEY. */
    REPLY_SIGNING_SECRET?: string;
    /** Required secret for anonymous session signatures and keyed IP hashes. */
    SESSION_SECRET?: string;
  }
}
