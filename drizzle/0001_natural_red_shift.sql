CREATE TABLE "ShareLink" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "DocRole" NOT NULL,
	"expiresAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ShareLink_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "isGuest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ShareLink_documentId_idx" ON "ShareLink" USING btree ("documentId");