CREATE TABLE "provinces" (
	"id" varchar(10) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provinces_name_unique" UNIQUE("name"),
	CONSTRAINT "provinces_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"province_id" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "districts_name_unique" UNIQUE("name"),
	CONSTRAINT "districts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "grid_substations" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"district_id" varchar(20) NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(20) NOT NULL,
	"capacity_mva" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grid_substations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "solar_installations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"substation_id" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"meter_id" varchar(50) NOT NULL,
	"inverter_id" varchar(50) NOT NULL,
	"installed_capacity_kw" numeric(8, 2) NOT NULL,
	"commissioned_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"api_key_hash" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solar_installations_meter_id_unique" UNIQUE("meter_id")
);
--> statement-breakpoint
CREATE TABLE "generation_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" varchar(50) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"power_kw" numeric(8, 3) NOT NULL,
	"energy_kwh" numeric(12, 3) NOT NULL,
	"voltage" numeric(6, 2) NOT NULL,
	"current_a" numeric(6, 2) NOT NULL,
	"frequency_hz" numeric(4, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"role" varchar(30) NOT NULL,
	"jurisdiction_province_id" varchar(10),
	"jurisdiction_district_id" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "grid_substations" ADD CONSTRAINT "grid_substations_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "solar_installations" ADD CONSTRAINT "solar_installations_substation_id_grid_substations_id_fk" FOREIGN KEY ("substation_id") REFERENCES "public"."grid_substations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "generation_readings" ADD CONSTRAINT "generation_readings_installation_id_solar_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."solar_installations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_jurisdiction_province_id_provinces_id_fk" FOREIGN KEY ("jurisdiction_province_id") REFERENCES "public"."provinces"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_jurisdiction_district_id_districts_id_fk" FOREIGN KEY ("jurisdiction_district_id") REFERENCES "public"."districts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_readings_inst_timestamp" ON "generation_readings" USING btree ("installation_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_readings_timestamp" ON "generation_readings" USING btree ("timestamp" DESC NULLS LAST);