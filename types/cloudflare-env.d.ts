declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FOOTBALL_DATA_API_TOKEN: string;
    ELKS_API_USERNAME?: string;
    ELKS_API_PASSWORD?: string;
    ELKS_SMS_FROM?: string;
    APP_PUBLIC_URL?: string;
    CRON_SECRET?: string;
  }
}
