ALTER TABLE "loan_entries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;