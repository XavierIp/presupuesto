CREATE TABLE "account_delegations" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"manager_id" text NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_delegations" ADD CONSTRAINT "account_delegations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_delegations" ADD CONSTRAINT "account_delegations_manager_id_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_delegations_pair_idx" ON "account_delegations" USING btree ("owner_id","manager_id");--> statement-breakpoint
CREATE INDEX "account_delegations_manager_idx" ON "account_delegations" USING btree ("manager_id");