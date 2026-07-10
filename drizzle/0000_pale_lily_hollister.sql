CREATE TYPE "public"."DocRole" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "DocumentMembership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" "DocRole" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DocumentUpdate" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "DocumentUpdate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"documentId" uuid NOT NULL,
	"update" "bytea" NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" uuid NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"passwordHash" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "VersionSnapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"snapshot" "bytea" NOT NULL,
	"upToUpdateId" bigint NOT NULL,
	"label" text NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DocumentMembership" ADD CONSTRAINT "DocumentMembership_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentMembership" ADD CONSTRAINT "DocumentMembership_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentUpdate" ADD CONSTRAINT "DocumentUpdate_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentUpdate" ADD CONSTRAINT "DocumentUpdate_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "VersionSnapshot" ADD CONSTRAINT "VersionSnapshot_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "VersionSnapshot" ADD CONSTRAINT "VersionSnapshot_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "DocumentMembership_documentId_userId_key" ON "DocumentMembership" USING btree ("documentId","userId");--> statement-breakpoint
CREATE INDEX "DocumentMembership_userId_idx" ON "DocumentMembership" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "DocumentUpdate_documentId_id_idx" ON "DocumentUpdate" USING btree ("documentId","id");--> statement-breakpoint
CREATE INDEX "VersionSnapshot_documentId_createdAt_idx" ON "VersionSnapshot" USING btree ("documentId","createdAt" DESC NULLS LAST);