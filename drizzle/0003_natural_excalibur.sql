CREATE TYPE "public"."loan_type" AS ENUM('fixed', 'open');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TYPE "public"."transaction_kind" ADD VALUE 'loan_out';--> statement-breakpoint
ALTER TYPE "public"."transaction_kind" ADD VALUE 'loan_in';--> statement-breakpoint
CREATE TABLE "loan_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"loan_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"note" text,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"requested_by" text,
	"disbursed_on" date,
	"lender_transaction_id" text,
	"borrower_transaction_id" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loan_payments" ADD COLUMN "status" "request_status" DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD COLUMN "lender_transaction_id" text;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD COLUMN "borrower_transaction_id" text;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "type" "loan_type" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "interest_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "installments" integer;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "first_due_on" date;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "pay_day" integer;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "credit_limit" bigint;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "lender_account_id" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "borrower_account_id" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "loan_id" text;--> statement-breakpoint
ALTER TABLE "loan_entries" ADD CONSTRAINT "loan_entries_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_entries" ADD CONSTRAINT "loan_entries_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_entries" ADD CONSTRAINT "loan_entries_lender_transaction_id_transactions_id_fk" FOREIGN KEY ("lender_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_entries" ADD CONSTRAINT "loan_entries_borrower_transaction_id_transactions_id_fk" FOREIGN KEY ("borrower_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loan_entries_loan_idx" ON "loan_entries" USING btree ("loan_id");--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_lender_transaction_id_transactions_id_fk" FOREIGN KEY ("lender_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_borrower_transaction_id_transactions_id_fk" FOREIGN KEY ("borrower_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_lender_account_id_financial_accounts_id_fk" FOREIGN KEY ("lender_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_account_id_financial_accounts_id_fk" FOREIGN KEY ("borrower_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE set null ON UPDATE no action;