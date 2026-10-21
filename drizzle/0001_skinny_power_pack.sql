CREATE TYPE "public"."payment_frequency" AS ENUM('monthly', 'yearly', 'once');--> statement-breakpoint
CREATE TABLE "recurring_payment_records" (
	"id" text PRIMARY KEY NOT NULL,
	"recurring_payment_id" text NOT NULL,
	"installment" integer NOT NULL,
	"due_on" date NOT NULL,
	"paid_on" date NOT NULL,
	"amount" bigint NOT NULL,
	"transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"category_id" text,
	"account_id" text,
	"frequency" "payment_frequency" NOT NULL,
	"start_date" date NOT NULL,
	"day_of_month" integer NOT NULL,
	"installments" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "currency" SET DEFAULT 'PEN';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "dni" text;--> statement-breakpoint
ALTER TABLE "recurring_payment_records" ADD CONSTRAINT "recurring_payment_records_recurring_payment_id_recurring_payments_id_fk" FOREIGN KEY ("recurring_payment_id") REFERENCES "public"."recurring_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payment_records" ADD CONSTRAINT "recurring_payment_records_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_payment_records_installment_idx" ON "recurring_payment_records" USING btree ("recurring_payment_id","installment");--> statement-breakpoint
CREATE INDEX "recurring_payments_user_idx" ON "recurring_payments" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_dni_unique" UNIQUE("dni");