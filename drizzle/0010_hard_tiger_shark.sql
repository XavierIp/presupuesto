ALTER TABLE "loans" ADD COLUMN "hidden_by_lender" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "hidden_by_borrower" boolean DEFAULT false NOT NULL;