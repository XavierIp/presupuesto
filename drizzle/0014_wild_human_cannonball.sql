CREATE TABLE "card_statement_amounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"due_month" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_statement_amounts" ADD CONSTRAINT "card_statement_amounts_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_statement_amounts_month_idx" ON "card_statement_amounts" USING btree ("account_id","due_month");