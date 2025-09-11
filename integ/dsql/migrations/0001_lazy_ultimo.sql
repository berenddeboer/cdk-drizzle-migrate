CREATE TABLE "subjects" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
