-- Generated from the Laravel migrations by tools/gen-schema.js
-- PostgreSQL 14+

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "firstname" VARCHAR(20) NOT NULL,
  "lastname" VARCHAR(20) NOT NULL,
  "desc" VARCHAR(200) NOT NULL,
  "login" VARCHAR(20) NOT NULL,
  "email" VARCHAR(100),
  "group" VARCHAR(20) NOT NULL,
  "password" VARCHAR(64) NOT NULL,
  "remember_token" VARCHAR(100),
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "group_id" INTEGER,
  "access" INTEGER,
  "regiNo" VARCHAR(20),
  "phone" VARCHAR(20),
  "branch_id" INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_login_uq" ON "users" ("login");

CREATE TABLE IF NOT EXISTS "smsFormat" (
  "id" SERIAL PRIMARY KEY,
  "type" VARCHAR(30) NOT NULL,
  "sender" VARCHAR(100) NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "smsLog" (
  "id" SERIAL PRIMARY KEY,
  "type" VARCHAR(30) NOT NULL,
  "sender" VARCHAR(100) NOT NULL,
  "recipient" VARCHAR(15) NOT NULL,
  "message" TEXT NOT NULL,
  "regiNo" VARCHAR(255) NOT NULL,
  "status" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "accounting_sector" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(500) NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "accounting" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(500) NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "amount" NUMERIC(18,2) NOT NULL,
  "date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "institute" (
  "name" VARCHAR(250) NOT NULL,
  "establish" VARCHAR(10) NOT NULL,
  "email" VARCHAR(100) NOT NULL,
  "web" VARCHAR(80) NOT NULL,
  "phoneNo" VARCHAR(15) NOT NULL,
  "address" VARCHAR(250) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "message" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(30) NOT NULL,
  "description" TEXT NOT NULL,
  "recording" VARCHAR(255) NOT NULL,
  "ictcore_recording_id" INTEGER NOT NULL,
  "ictcore_program_id" INTEGER NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "telenor_file_id" VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS "ictcore_integration" (
  "id" SERIAL PRIMARY KEY,
  "ictcore_url" VARCHAR(255) NOT NULL,
  "ictcore_user" VARCHAR(50) NOT NULL,
  "ictcore_password" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "method" VARCHAR(255),
  "type" VARCHAR(255),
  "ictcore_account_id" INTEGER,
  "type1" VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS "ictcore_attendance" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(30) NOT NULL,
  "description" TEXT NOT NULL,
  "recording" VARCHAR(255) NOT NULL,
  "ictcore_recording_id" VARCHAR(30) NOT NULL,
  "ictcore_program_id" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "telenor_file_id" VARCHAR(20) NOT NULL,
  "late_description" VARCHAR(255),
  "late_file" VARCHAR(255),
  "ictcore_recording_id_late" VARCHAR(255),
  "ictcore_program_id_late" VARCHAR(255),
  "telenor_file_id_late" VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS "ictcore_fees" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(30) NOT NULL,
  "description" TEXT NOT NULL,
  "recording" VARCHAR(255) NOT NULL,
  "ictcore_recording_id" VARCHAR(30) NOT NULL,
  "ictcore_program_id" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "telenor_file_id" VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS "cronschedule" (
  "id" SERIAL PRIMARY KEY,
  "date" INTEGER NOT NULL,
  "time" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "notification_type" (
  "id" SERIAL PRIMARY KEY,
  "notification" VARCHAR(20) NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "permission" (
  "id" SERIAL PRIMARY KEY,
  "permission_name" VARCHAR(100) NOT NULL,
  "permission_group" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "permission_type" VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS "branches" (
  "id" SERIAL PRIMARY KEY,
  "branch_name" VARCHAR(50) NOT NULL,
  "branch_url" VARCHAR(255) NOT NULL,
  "username" VARCHAR(150) NOT NULL,
  "password" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "verify_codes" (
  "id" SERIAL PRIMARY KEY,
  "user_id" VARCHAR(50) NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "verification_codes" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "code" VARCHAR(150) NOT NULL,
  "status" VARCHAR(10) NOT NULL DEFAULT 0,
  "ip_address" VARCHAR(191),
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "accountant" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(200),
  "name" VARCHAR(100),
  "email" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "x" VARCHAR(100),
  "ion_user_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "alloted_bed" (
  "id" SERIAL PRIMARY KEY,
  "number" VARCHAR(100),
  "category" VARCHAR(100),
  "patient" INTEGER,
  "a_time" TIMESTAMP,
  "d_time" TIMESTAMP,
  "status" VARCHAR(100),
  "x" VARCHAR(100),
  "bed_id" INTEGER
);

CREATE TABLE IF NOT EXISTS "appointment" (
  "id" SERIAL PRIMARY KEY,
  "patient" INTEGER,
  "doctor" INTEGER,
  "date" DATE,
  "time_slot" VARCHAR(100),
  "s_time" TIMESTAMP,
  "e_time" TIMESTAMP,
  "remarks" VARCHAR(500),
  "add_date" DATE,
  "registration_time" TIMESTAMP,
  "s_time_key" VARCHAR(100),
  "status" VARCHAR(100),
  "user" VARCHAR(100),
  "request" VARCHAR(100),
  "b_p" VARCHAR(100),
  "pulse" VARCHAR(100),
  "temprature" VARCHAR(100),
  "weight" VARCHAR(100),
  "token_no" INTEGER,
  "checked_in_at" TIMESTAMP,
  "consult_started_at" TIMESTAMP,
  "checked_out_at" TIMESTAMP,
  "visit_type" VARCHAR(20),
  "payment_id" INTEGER,
  "mode" VARCHAR(12),
  "video_room" VARCHAR(80),
  "branch_id" INTEGER
);
CREATE INDEX IF NOT EXISTS "appointment_branch_id_ix" ON "appointment" ("branch_id");

CREATE TABLE IF NOT EXISTS "bankb" (
  "id" SERIAL PRIMARY KEY,
  "group" VARCHAR(100),
  "status" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "bed" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "number" VARCHAR(100),
  "description" VARCHAR(100),
  "last_a_time" TIMESTAMP,
  "last_d_time" TIMESTAMP,
  "status" VARCHAR(100),
  "bed_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "bed_category" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "description" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "department" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100),
  "description" VARCHAR(1000),
  "x" VARCHAR(10),
  "y" VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS "diagnostic_report" (
  "id" SERIAL PRIMARY KEY,
  "date" DATE,
  "invoice" VARCHAR(100),
  "report" VARCHAR(10000),
  "status" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "doctor" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(100),
  "name" VARCHAR(100),
  "email" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "department" VARCHAR(100),
  "profile" VARCHAR(100),
  "x" VARCHAR(100),
  "y" VARCHAR(10),
  "ion_user_id" VARCHAR(100),
  "procedure_id" VARCHAR(100),
  "share_policy_id" INTEGER
);

CREATE TABLE IF NOT EXISTS "donor" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100),
  "group" VARCHAR(10),
  "age" VARCHAR(10),
  "sex" VARCHAR(10),
  "ldd" VARCHAR(100),
  "phone" VARCHAR(100),
  "email" VARCHAR(100),
  "add_date" DATE
);

CREATE TABLE IF NOT EXISTS "email" (
  "id" SERIAL PRIMARY KEY,
  "subject" VARCHAR(100),
  "date" DATE,
  "message" VARCHAR(10000),
  "reciepient" VARCHAR(100),
  "user" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "email_settings" (
  "id" SERIAL PRIMARY KEY,
  "admin_email" VARCHAR(100),
  "type" VARCHAR(100),
  "user" VARCHAR(100),
  "password" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "expense" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "date" DATE,
  "note" VARCHAR(1000),
  "amount" VARCHAR(100),
  "user" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "expense_category" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "description" VARCHAR(100),
  "x" VARCHAR(100),
  "y" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "featured" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(1000),
  "name" VARCHAR(100),
  "profile" VARCHAR(100),
  "description" VARCHAR(1000)
);

CREATE TABLE IF NOT EXISTS "holidays" (
  "id" SERIAL PRIMARY KEY,
  "doctor" VARCHAR(100),
  "date" DATE,
  "x" VARCHAR(100),
  "y" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "lab" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "patient" INTEGER,
  "doctor" INTEGER,
  "date" DATE,
  "category_name" VARCHAR(1000),
  "report" VARCHAR(10000),
  "status" VARCHAR(100),
  "user" VARCHAR(100),
  "patient_name" VARCHAR(100),
  "patient_phone" VARCHAR(100),
  "patient_address" VARCHAR(100),
  "doctor_name" VARCHAR(100),
  "date_string" VARCHAR(100),
  "invoice_id" VARCHAR(100),
  "report_date" DATE,
  "cnic" VARCHAR(100),
  "token_no" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "lab_category" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "description" VARCHAR(100),
  "reference_value" VARCHAR(1000),
  "procedure_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "laboratorist" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(100),
  "name" VARCHAR(100),
  "email" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "x" VARCHAR(100),
  "y" VARCHAR(100),
  "ion_user_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "medical_history" (
  "id" SERIAL PRIMARY KEY,
  "patient_id" INTEGER,
  "title" VARCHAR(100),
  "description" VARCHAR(10000),
  "patient_name" VARCHAR(100),
  "patient_address" VARCHAR(500),
  "patient_phone" VARCHAR(100),
  "img_url" VARCHAR(500),
  "date" DATE,
  "registration_time" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "medicine" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100),
  "category" VARCHAR(100),
  "price" VARCHAR(100),
  "box" VARCHAR(100),
  "s_price" VARCHAR(100),
  "quantity" INTEGER,
  "generic" VARCHAR(100),
  "company" VARCHAR(100),
  "effects" VARCHAR(100),
  "e_date" DATE,
  "add_date" DATE
);

CREATE TABLE IF NOT EXISTS "medicine_category" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "description" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "membership" (
  "id" SERIAL PRIMARY KEY,
  "patient_id" VARCHAR(200),
  "membership_type" VARCHAR(100),
  "date" DATE,
  "expiry" VARCHAR(100),
  "status" VARCHAR(100),
  "ion_user_id" VARCHAR(100),
  "created_at" TIMESTAMP,
  "card_no" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "membership_settings" (
  "id" SERIAL PRIMARY KEY,
  "membership_name" VARCHAR(200),
  "membership_price" VARCHAR(100),
  "expiry" VARCHAR(100),
  "created_at" TIMESTAMP,
  "discount" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "notice" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(500),
  "description" VARCHAR(100),
  "date" DATE,
  "type" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "nurse" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(100),
  "name" VARCHAR(100),
  "email" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "x" VARCHAR(100),
  "y" VARCHAR(100),
  "z" VARCHAR(100),
  "ion_user_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "ot_payment" (
  "id" SERIAL PRIMARY KEY,
  "patient" INTEGER,
  "doctor_c_s" VARCHAR(100),
  "doctor_a_s_1" VARCHAR(100),
  "doctor_a_s_2" VARCHAR(100),
  "doctor_anaes" VARCHAR(100),
  "n_o_o" VARCHAR(100),
  "c_s_f" VARCHAR(100),
  "a_s_f_1" VARCHAR(100),
  "a_s_f_2" VARCHAR(11),
  "anaes_f" VARCHAR(100),
  "ot_charge" VARCHAR(100),
  "cab_rent" VARCHAR(100),
  "seat_rent" VARCHAR(100),
  "others" VARCHAR(100),
  "discount" VARCHAR(100),
  "date" DATE,
  "amount" VARCHAR(100),
  "doctor_fees" VARCHAR(100),
  "hospital_fees" VARCHAR(100),
  "gross_total" VARCHAR(100),
  "flat_discount" VARCHAR(100),
  "amount_received" VARCHAR(100),
  "status" VARCHAR(100),
  "user" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "patient" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(100),
  "name" VARCHAR(100),
  "email" VARCHAR(1000),
  "doctor" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "sex" VARCHAR(100),
  "birthdate" DATE,
  "age" VARCHAR(100),
  "bloodgroup" VARCHAR(100),
  "ion_user_id" VARCHAR(100),
  "patient_id" VARCHAR(100),
  "add_date" DATE,
  "registration_time" TIMESTAMP,
  "how_added" VARCHAR(100),
  "father_name" VARCHAR(100),
  "patient_type_id" INTEGER,
  "cnic" VARCHAR(20),
  "guardian_relation" VARCHAR(40),
  "guardian_mrn" VARCHAR(20),
  "mlc" BOOLEAN DEFAULT FALSE,
  "old_mrn" VARCHAR(40),
  "employee_no" VARCHAR(40),
  "alt_phone" VARCHAR(40),
  "city" VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS "patient_deposit" (
  "id" SERIAL PRIMARY KEY,
  "patient" INTEGER,
  "payment_id" VARCHAR(100),
  "date" DATE,
  "deposited_amount" VARCHAR(100),
  "amount_received_id" VARCHAR(100),
  "deposit_type" VARCHAR(100),
  "gateway" VARCHAR(100),
  "user" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "patient_material" (
  "id" SERIAL PRIMARY KEY,
  "date" DATE,
  "title" VARCHAR(100),
  "category" VARCHAR(100),
  "patient" INTEGER,
  "patient_name" VARCHAR(100),
  "patient_address" VARCHAR(100),
  "patient_phone" VARCHAR(100),
  "url" VARCHAR(1000),
  "date_string" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "payment" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "patient" INTEGER,
  "doctor" INTEGER,
  "date" DATE,
  "amount" VARCHAR(100),
  "vat" VARCHAR(100) DEFAULT '0',
  "x_ray" VARCHAR(100),
  "flat_vat" VARCHAR(100),
  "discount" VARCHAR(100) DEFAULT '0',
  "flat_discount" VARCHAR(100),
  "gross_total" VARCHAR(100),
  "remarks" VARCHAR(500),
  "hospital_amount" VARCHAR(100),
  "doctor_amount" VARCHAR(100),
  "category_amount" VARCHAR(1000),
  "category_name" VARCHAR(1000),
  "amount_received" VARCHAR(100),
  "deposit_type" VARCHAR(100),
  "status" VARCHAR(100),
  "user" VARCHAR(100),
  "patient_name" VARCHAR(100),
  "patient_phone" VARCHAR(100),
  "patient_address" VARCHAR(100),
  "doctor_name" VARCHAR(100),
  "date_string" VARCHAR(100),
  "patient_type_id" INTEGER,
  "care_setting" VARCHAR(10),
  "referring_doctor" INTEGER,
  "branch_id" INTEGER
);
CREATE INDEX IF NOT EXISTS "payment_branch_id_ix" ON "payment" ("branch_id");

CREATE TABLE IF NOT EXISTS "paymentGateway" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100),
  "merchant_key" VARCHAR(100),
  "salt" VARCHAR(100),
  "x" VARCHAR(100),
  "y" VARCHAR(100),
  "APIUsername" VARCHAR(100),
  "APIPassword" VARCHAR(100),
  "APISignature" VARCHAR(100),
  "status" VARCHAR(1000)
);

CREATE TABLE IF NOT EXISTS "payment_category" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "description" VARCHAR(100),
  "c_price" VARCHAR(100),
  "type" VARCHAR(100),
  "d_commission" INTEGER,
  "h_commission" INTEGER,
  "department" VARCHAR(100),
  "service_kind" VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS "pharmacist" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(100),
  "name" VARCHAR(100),
  "email" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "x" VARCHAR(100),
  "y" VARCHAR(100),
  "ion_user_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "pharmacy_expense" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "date" DATE,
  "amount" VARCHAR(100),
  "user" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "pharmacy_expense_category" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "description" VARCHAR(100),
  "x" VARCHAR(100),
  "y" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "pharmacy_payment" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "patient" VARCHAR(100),
  "doctor" VARCHAR(100),
  "date" DATE,
  "amount" VARCHAR(100),
  "vat" VARCHAR(100) DEFAULT '0',
  "x_ray" VARCHAR(100),
  "flat_vat" VARCHAR(100),
  "discount" VARCHAR(100) DEFAULT '0',
  "flat_discount" VARCHAR(100),
  "gross_total" VARCHAR(100),
  "hospital_amount" VARCHAR(100),
  "doctor_amount" VARCHAR(100),
  "category_amount" VARCHAR(1000),
  "category_name" VARCHAR(1000),
  "amount_received" VARCHAR(100),
  "status" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "pharmacy_payment_category" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(100),
  "description" VARCHAR(100),
  "c_price" VARCHAR(100),
  "d_commission" INTEGER,
  "h_commission" INTEGER
);

CREATE TABLE IF NOT EXISTS "prescription" (
  "id" SERIAL PRIMARY KEY,
  "date" DATE,
  "patient" INTEGER,
  "doctor" INTEGER,
  "symptom" VARCHAR(100),
  "advice" VARCHAR(1000),
  "state" VARCHAR(100),
  "dd" VARCHAR(100),
  "medicine" VARCHAR(1000),
  "validity" VARCHAR(100),
  "note" VARCHAR(1000)
);

CREATE TABLE IF NOT EXISTS "receptionist" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(100),
  "name" VARCHAR(100),
  "email" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "x" VARCHAR(100),
  "ion_user_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "report" (
  "id" SERIAL PRIMARY KEY,
  "report_type" VARCHAR(100),
  "patient" INTEGER,
  "description" VARCHAR(500),
  "doctor" INTEGER,
  "date" DATE,
  "add_date" DATE
);

CREATE TABLE IF NOT EXISTS "service" (
  "id" SERIAL PRIMARY KEY,
  "img_url" VARCHAR(1000),
  "title" VARCHAR(100),
  "description" VARCHAR(1000)
);

CREATE TABLE IF NOT EXISTS "settings" (
  "id" SERIAL PRIMARY KEY,
  "system_vendor" VARCHAR(100),
  "title" VARCHAR(100),
  "address" VARCHAR(100),
  "phone" VARCHAR(100),
  "email" VARCHAR(100),
  "facebook_id" VARCHAR(100),
  "currency" VARCHAR(100),
  "language" VARCHAR(100),
  "discount" VARCHAR(100),
  "vat" VARCHAR(100),
  "login_title" VARCHAR(100),
  "logo" VARCHAR(500),
  "invoice_logo" VARCHAR(500),
  "payment_gateway" VARCHAR(100),
  "sms_gateway" VARCHAR(100),
  "codec_username" VARCHAR(100),
  "codec_purchase_code" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "slide" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(100),
  "img_url" VARCHAR(1000),
  "text1" VARCHAR(500),
  "text2" VARCHAR(500),
  "text3" VARCHAR(500),
  "position" VARCHAR(100),
  "status" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "sms" (
  "id" SERIAL PRIMARY KEY,
  "date" DATE,
  "message" VARCHAR(100),
  "recipient" VARCHAR(100),
  "user" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "sms_settings" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100),
  "username" VARCHAR(100),
  "password" VARCHAR(100),
  "api_id" VARCHAR(100),
  "sender" VARCHAR(100),
  "authkey" VARCHAR(100),
  "user" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "template" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100),
  "template" VARCHAR(10000),
  "user" VARCHAR(100),
  "x" VARCHAR(100),
  "procedure_id" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "time_schedule" (
  "id" SERIAL PRIMARY KEY,
  "doctor" VARCHAR(500),
  "weekday" VARCHAR(100),
  "s_time" TIMESTAMP,
  "e_time" TIMESTAMP,
  "s_time_key" VARCHAR(100),
  "duration" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "time_slot" (
  "id" SERIAL PRIMARY KEY,
  "doctor" VARCHAR(100),
  "s_time" TIMESTAMP,
  "e_time" TIMESTAMP,
  "weekday" VARCHAR(100),
  "s_time_key" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "website_settings" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(100),
  "logo" VARCHAR(1000),
  "address" VARCHAR(500),
  "phone" VARCHAR(100),
  "emergency" VARCHAR(100),
  "support" VARCHAR(100),
  "email" VARCHAR(100),
  "currency" VARCHAR(100),
  "block_1_text_under_title" VARCHAR(500),
  "service_block__text_under_title" VARCHAR(500),
  "doctor_block__text_under_title" VARCHAR(500),
  "facebook_id" VARCHAR(100),
  "twitter_id" VARCHAR(100),
  "google_id" VARCHAR(100),
  "youtube_id" VARCHAR(100),
  "skype_id" VARCHAR(100),
  "x" VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS "accounting_settings" (
  "id" SERIAL PRIMARY KEY,
  "company_id" VARCHAR(100),
  "api_link" VARCHAR(255),
  "username" VARCHAR(100),
  "password" VARCHAR(255),
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "prescription_medicine" (
  "id" SERIAL PRIMARY KEY,
  "prescription_id" INTEGER NOT NULL,
  "medicine_id" INTEGER,
  "name" VARCHAR(200) NOT NULL,
  "dosage" VARCHAR(100),
  "duration" VARCHAR(100),
  "instructions" VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS "prescription_medicine_prescription_id_ix" ON "prescription_medicine" ("prescription_id");
CREATE INDEX IF NOT EXISTS "prescription_medicine_medicine_id_ix" ON "prescription_medicine" ("medicine_id");

CREATE TABLE IF NOT EXISTS "lab_test" (
  "id" SERIAL PRIMARY KEY,
  "lab_id" INTEGER NOT NULL,
  "lab_category_id" INTEGER,
  "name" VARCHAR(200) NOT NULL,
  "reference_value" VARCHAR(1000),
  "result" VARCHAR(1000),
  "status" VARCHAR(40) NOT NULL DEFAULT 'requested',
  "reported_at" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS "lab_test_lab_id_ix" ON "lab_test" ("lab_id");
CREATE INDEX IF NOT EXISTS "lab_test_lab_category_id_ix" ON "lab_test" ("lab_category_id");

CREATE TABLE IF NOT EXISTS "pharmacy_sale_item" (
  "id" SERIAL PRIMARY KEY,
  "pharmacy_payment_id" INTEGER NOT NULL,
  "medicine_id" INTEGER,
  "name" VARCHAR(200) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "line_total" NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "pharmacy_sale_item_pharmacy_payment_id_ix" ON "pharmacy_sale_item" ("pharmacy_payment_id");
CREATE INDEX IF NOT EXISTS "pharmacy_sale_item_medicine_id_ix" ON "pharmacy_sale_item" ("medicine_id");

CREATE TABLE IF NOT EXISTS "invoice_item" (
  "id" SERIAL PRIMARY KEY,
  "payment_id" INTEGER NOT NULL,
  "payment_category_id" INTEGER,
  "name" VARCHAR(200) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "line_total" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "doctor_id" INTEGER
);
CREATE INDEX IF NOT EXISTS "invoice_item_payment_id_ix" ON "invoice_item" ("payment_id");
CREATE INDEX IF NOT EXISTS "invoice_item_payment_category_id_ix" ON "invoice_item" ("payment_category_id");

CREATE TABLE IF NOT EXISTS "invoice_payment" (
  "id" SERIAL PRIMARY KEY,
  "payment_id" INTEGER NOT NULL,
  "amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "method" VARCHAR(60),
  "reference" VARCHAR(120),
  "paid_at" VARCHAR(100),
  "received_by" INTEGER,
  "shift_close_id" INTEGER
);
CREATE INDEX IF NOT EXISTS "invoice_payment_payment_id_ix" ON "invoice_payment" ("payment_id");
CREATE INDEX IF NOT EXISTS "invoice_payment_received_by_ix" ON "invoice_payment" ("received_by");
CREATE INDEX IF NOT EXISTS "invoice_payment_shift_close_id_ix" ON "invoice_payment" ("shift_close_id");

CREATE TABLE IF NOT EXISTS "patient_type" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(80) NOT NULL,
  "kind" VARCHAR(20) NOT NULL DEFAULT 'general',
  "company" VARCHAR(120),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "patient_type_name_uq" ON "patient_type" ("name");

CREATE TABLE IF NOT EXISTS "service_price" (
  "id" SERIAL PRIMARY KEY,
  "payment_category_id" INTEGER NOT NULL,
  "patient_type_id" INTEGER NOT NULL,
  "opd_price" NUMERIC(12,2),
  "ipd_price" NUMERIC(12,2),
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_price_payment_category_id_patient_type_id_uq" ON "service_price" ("payment_category_id", "patient_type_id");

CREATE TABLE IF NOT EXISTS "share_policy" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "notes" VARCHAR(255),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "share_policy_name_uq" ON "share_policy" ("name");

CREATE TABLE IF NOT EXISTS "share_rule" (
  "id" SERIAL PRIMARY KEY,
  "share_policy_id" INTEGER NOT NULL,
  "payment_category_id" INTEGER,
  "department" VARCHAR(100),
  "patient_type_id" INTEGER,
  "doctor_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "referral_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "share_rule_share_policy_id_ix" ON "share_rule" ("share_policy_id");

CREATE TABLE IF NOT EXISTS "doctor_share" (
  "id" SERIAL PRIMARY KEY,
  "payment_id" INTEGER NOT NULL,
  "invoice_item_id" INTEGER NOT NULL,
  "doctor_id" INTEGER NOT NULL,
  "role" VARCHAR(12) NOT NULL,
  "share_rule_id" INTEGER,
  "base_amount" NUMERIC(12,2) NOT NULL,
  "percent" NUMERIC(5,2) NOT NULL,
  "amount" NUMERIC(12,2) NOT NULL,
  "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
  "approved_by" INTEGER,
  "approved_at" TIMESTAMP,
  "paid_at" TIMESTAMP,
  "payout_ref" VARCHAR(60),
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "doctor_share_payment_id_ix" ON "doctor_share" ("payment_id");
CREATE INDEX IF NOT EXISTS "doctor_share_invoice_item_id_ix" ON "doctor_share" ("invoice_item_id");
CREATE INDEX IF NOT EXISTS "doctor_share_doctor_id_ix" ON "doctor_share" ("doctor_id");

CREATE TABLE IF NOT EXISTS "shift_close" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "opened_at" TIMESTAMP,
  "closed_at" TIMESTAMP NOT NULL,
  "payments_count" INTEGER NOT NULL DEFAULT 0,
  "total" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "cash" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "bank_transfer" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "card" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "cheque" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "other" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "counted_cash" NUMERIC(12,2),
  "difference" NUMERIC(12,2),
  "comment" VARCHAR(500),
  "closed_by" INTEGER,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP,
  "branch_id" INTEGER
);
CREATE INDEX IF NOT EXISTS "shift_close_user_id_ix" ON "shift_close" ("user_id");

CREATE TABLE IF NOT EXISTS "doctor_slot" (
  "id" SERIAL PRIMARY KEY,
  "doctor_id" INTEGER NOT NULL,
  "weekday" SMALLINT NOT NULL,
  "start_time" VARCHAR(5) NOT NULL,
  "end_time" VARCHAR(5) NOT NULL,
  "slot_minutes" SMALLINT NOT NULL DEFAULT 15,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "doctor_slot_doctor_id_ix" ON "doctor_slot" ("doctor_id");

CREATE TABLE IF NOT EXISTS "slot_block" (
  "id" SERIAL PRIMARY KEY,
  "doctor_id" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "start_time" VARCHAR(5),
  "end_time" VARCHAR(5),
  "reason" VARCHAR(120),
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "slot_block_doctor_id_ix" ON "slot_block" ("doctor_id");

CREATE TABLE IF NOT EXISTS "visit_fee" (
  "id" SERIAL PRIMARY KEY,
  "doctor_id" INTEGER,
  "visit_type" VARCHAR(20) NOT NULL,
  "shift" VARCHAR(10) NOT NULL DEFAULT 'any',
  "payment_category_id" INTEGER NOT NULL,
  "fee" NUMERIC(12,2),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "consultation" (
  "id" SERIAL PRIMARY KEY,
  "appointment_id" INTEGER,
  "patient_id" INTEGER NOT NULL,
  "doctor_id" INTEGER,
  "date" DATE NOT NULL,
  "presenting_complaint" TEXT,
  "history" TEXT,
  "examination" TEXT,
  "provisional_diagnosis" TEXT,
  "diagnosis" TEXT,
  "plan" TEXT,
  "treatment" TEXT,
  "follow_up_date" DATE,
  "follow_up_notes" VARCHAR(255),
  "allergies" TEXT,
  "past_history" TEXT,
  "social_history" TEXT,
  "specialty" TEXT,
  "immunizations" TEXT,
  "status" VARCHAR(12) NOT NULL DEFAULT 'draft',
  "completed_at" TIMESTAMP,
  "created_by" INTEGER,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "consultation_appointment_id_uq" ON "consultation" ("appointment_id");
CREATE INDEX IF NOT EXISTS "consultation_patient_id_ix" ON "consultation" ("patient_id");
CREATE INDEX IF NOT EXISTS "consultation_doctor_id_ix" ON "consultation" ("doctor_id");

CREATE TABLE IF NOT EXISTS "consult_template" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "doctor_id" INTEGER,
  "fields" TEXT NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "radiology_exam" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "modality" VARCHAR(20) NOT NULL,
  "payment_category_id" INTEGER,
  "report_template" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "radiology_order" (
  "id" SERIAL PRIMARY KEY,
  "patient_id" INTEGER NOT NULL,
  "doctor_id" INTEGER,
  "appointment_id" INTEGER,
  "radiology_exam_id" INTEGER,
  "name" VARCHAR(120) NOT NULL,
  "modality" VARCHAR(20) NOT NULL,
  "urgent" BOOLEAN NOT NULL DEFAULT FALSE,
  "clinical_notes" VARCHAR(1000),
  "status" VARCHAR(12) NOT NULL DEFAULT 'ordered',
  "scheduled_at" TIMESTAMP,
  "performed_at" TIMESTAMP,
  "findings" TEXT,
  "impression" TEXT,
  "reported_by" INTEGER,
  "reported_at" TIMESTAMP,
  "payment_id" INTEGER,
  "created_by" INTEGER,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "radiology_order_patient_id_ix" ON "radiology_order" ("patient_id");

CREATE TABLE IF NOT EXISTS "service_package_item" (
  "id" SERIAL PRIMARY KEY,
  "package_id" INTEGER NOT NULL,
  "component_id" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "service_package_item_package_id_ix" ON "service_package_item" ("package_id");

CREATE TABLE IF NOT EXISTS "hospital_branch" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "address" VARCHAR(255),
  "phone" VARCHAR(60),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "hospital_branch_name_uq" ON "hospital_branch" ("name");

DO $$ BEGIN ALTER TABLE "alloted_bed" ADD CONSTRAINT "alloted_bed_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "alloted_bed" ADD CONSTRAINT "alloted_bed_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "bed"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "appointment" ADD CONSTRAINT "appointment_doctor_fk" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab" ADD CONSTRAINT "lab_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lab" ADD CONSTRAINT "lab_doctor_fk" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "medical_history" ADD CONSTRAINT "medical_history_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ot_payment" ADD CONSTRAINT "ot_payment_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "patient_deposit" ADD CONSTRAINT "patient_deposit_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "patient_material" ADD CONSTRAINT "patient_material_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payment" ADD CONSTRAINT "payment_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payment" ADD CONSTRAINT "payment_doctor_fk" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "prescription" ADD CONSTRAINT "prescription_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "prescription" ADD CONSTRAINT "prescription_doctor_fk" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "report" ADD CONSTRAINT "report_patient_fk" FOREIGN KEY ("patient") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "report" ADD CONSTRAINT "report_doctor_fk" FOREIGN KEY ("doctor") REFERENCES "doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" SERIAL PRIMARY KEY, "description" TEXT, "userType" VARCHAR(255), "userId" INTEGER, "route" TEXT,
  "ipAddress" VARCHAR(45), "userAgent" TEXT, "locale" VARCHAR(255), "referer" TEXT, "methodType" VARCHAR(20),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP, "deleted_at" TIMESTAMP
);
