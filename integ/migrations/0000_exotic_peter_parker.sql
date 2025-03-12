CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
