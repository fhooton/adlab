CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"amount_cents" integer,
	"action_payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"result_message" text,
	"version" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"kind" text NOT NULL,
	"aspect" text NOT NULL,
	"storage_key" text NOT NULL,
	"hash" text NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"duration_seconds" real,
	"renderer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"product" text NOT NULL,
	"product_url" text NOT NULL,
	"audience" text NOT NULL,
	"offer" text NOT NULL,
	"markets" jsonb NOT NULL,
	"languages" jsonb NOT NULL,
	"platforms" jsonb NOT NULL,
	"conversion_event" text NOT NULL,
	"weekly_cap_cents" integer NOT NULL,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"rule_version" text NOT NULL,
	"inputs_snapshot" jsonb NOT NULL,
	"status" text NOT NULL,
	"proposed_by" text NOT NULL,
	"approved_by" text,
	"applied_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"skill_version" text NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text,
	"tokens" integer,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"output_ids" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hypotheses" (
	"id" text PRIMARY KEY NOT NULL,
	"brief_id" text NOT NULL,
	"concept" text NOT NULL,
	"persona" text NOT NULL,
	"format" text NOT NULL,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_by" text NOT NULL,
	"decided_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learnings" (
	"id" text PRIMARY KEY NOT NULL,
	"brief_id" text,
	"statement" text NOT NULL,
	"evidence_ids" jsonb NOT NULL,
	"confidence" text NOT NULL,
	"tags" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_object_id" text NOT NULL,
	"variant_id" text,
	"test_id" text,
	"impressions" integer NOT NULL,
	"spend_cents" integer NOT NULL,
	"views_3s" integer NOT NULL,
	"views_15s" integer NOT NULL,
	"clicks" integer NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"conversions" integer NOT NULL,
	"frequency" real,
	"definitions_version" text NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"kind" text NOT NULL,
	"parent_id" text,
	"variant_id" text,
	"test_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"budget_cents" integer,
	"idempotency_key" text NOT NULL,
	"last_seen_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"rater" text NOT NULL,
	"score" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"brief_id" text NOT NULL,
	"summary" text NOT NULL,
	"sources" jsonb NOT NULL,
	"reference_ads" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"brief_id" text NOT NULL,
	"test_id" text NOT NULL,
	"week_start" date NOT NULL,
	"committed_cents" integer NOT NULL,
	"actual_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"description" text NOT NULL,
	"format" text NOT NULL,
	"duration_seconds" real NOT NULL,
	"aspect_ratios" jsonb NOT NULL,
	"variable_schema" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" text PRIMARY KEY NOT NULL,
	"brief_id" text NOT NULL,
	"stage" integer NOT NULL,
	"platform" text NOT NULL,
	"structure" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"budget_cents" integer NOT NULL,
	"duration_hours" integer NOT NULL,
	"variant_ids" jsonb NOT NULL,
	"rule_version" text NOT NULL,
	"preflight" jsonb,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" text PRIMARY KEY NOT NULL,
	"hypothesis_id" text NOT NULL,
	"brief_id" text NOT NULL,
	"label" text NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL,
	"template_id" text NOT NULL,
	"template_version" text NOT NULL,
	"variables" jsonb NOT NULL,
	"copy" jsonb NOT NULL,
	"hook_type" text NOT NULL,
	"footage_source" text NOT NULL,
	"aspect_ratios" jsonb NOT NULL,
	"tags" jsonb NOT NULL,
	"generator" jsonb NOT NULL,
	"generation_run_id" text,
	"spec_hash" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypotheses" ADD CONSTRAINT "hypotheses_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_platform_object_id_platform_objects_id_fk" FOREIGN KEY ("platform_object_id") REFERENCES "public"."platform_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_objects" ADD CONSTRAINT "platform_objects_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_objects" ADD CONSTRAINT "platform_objects_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_hypothesis_id_hypotheses_id_fk" FOREIGN KEY ("hypothesis_id") REFERENCES "public"."hypotheses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_idem_idx" ON "approvals" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_variant_aspect_hash_idx" ON "assets" USING btree ("variant_id","aspect","hash");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_idem_idx" ON "decisions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "decisions_test_idx" ON "decisions" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "hypotheses_brief_idx" ON "hypotheses" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_idx" ON "jobs" USING btree ("dedupe_key") WHERE "jobs"."dedupe_key" is not null and "jobs"."status" in ('queued','running');--> statement-breakpoint
CREATE INDEX "metric_snapshots_object_idx" ON "metric_snapshots" USING btree ("platform_object_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_objects_idem_idx" ON "platform_objects" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_objects_external_idx" ON "platform_objects" USING btree ("platform","external_id");--> statement-breakpoint
CREATE INDEX "platform_objects_test_idx" ON "platform_objects" USING btree ("test_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_variant_rater_idx" ON "ratings" USING btree ("variant_id","rater");--> statement-breakpoint
CREATE UNIQUE INDEX "spend_ledger_test_week_idx" ON "spend_ledger" USING btree ("test_id","week_start");--> statement-breakpoint
CREATE INDEX "spend_ledger_week_idx" ON "spend_ledger" USING btree ("account","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_key_version_idx" ON "templates" USING btree ("template_key","version");--> statement-breakpoint
CREATE INDEX "variants_hypothesis_idx" ON "variants" USING btree ("hypothesis_id");--> statement-breakpoint
CREATE INDEX "variants_brief_idx" ON "variants" USING btree ("brief_id");