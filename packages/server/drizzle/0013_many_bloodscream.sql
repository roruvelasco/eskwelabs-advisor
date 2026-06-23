CREATE TABLE "usage_budget_counters" (
  "period_kind" text NOT NULL,
  "period_key" text NOT NULL,
  "estimated_spend_usd" numeric NOT NULL DEFAULT '0',
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "usage_budget_counters_period_kind_period_key_pk" PRIMARY KEY("period_kind", "period_key")
);
--> statement-breakpoint
CREATE TABLE "usage_limits" (
  "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "max_messages_per_user_per_day" integer DEFAULT 25 NOT NULL,
  "max_tokens_per_user_per_day" integer DEFAULT 100000 NOT NULL,
  "daily_budget_usd" numeric DEFAULT '10' NOT NULL,
  "monthly_budget_usd" numeric DEFAULT '300' NOT NULL,
  "rate_limit_window_seconds" integer DEFAULT 60 NOT NULL,
  "rate_limit_max_requests" integer DEFAULT 100 NOT NULL,
  "updated_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
