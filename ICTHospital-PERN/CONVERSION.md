# Conversion notes

## Controller → Express route file
| Laravel controller | Express (`backend/src/routes/`) | React (`frontend/src/pages/`) |
|---|---|---|
| Auth / Home / Users / Settings / Permission / Dashboard / Search / Institute / Branch / Barcode / LaravelLogger | auth, users, settings, permissions, dashboard, search, institute, hospitalBranches, barcode, activity | Auth, Admin |
| Patient, MedicalHistory | patients, history | Patients |
| Doctor, Staff, Department | doctors, staff, departments | People |
| Appointment, Opd (queue, slots, blocks, visit fees) | appointments, opd | Appointments |
| Consultation | consultations | Consultation |
| Prescription, Medicine, Pharmacy, Bed, Admission | prescriptions, medicines, pharmacy, beds, admissions | Clinical |
| Lab (+ catalogue), Radiology (+ catalogue) | lab, radiology | Diagnostics |
| PaymentCategory, Package, Pricing, PaymentGateway, Invoice, Cash, DoctorShare | services, packageItems, pricing, gateways, invoices, cash, doctorShare | Billing |
| Report | reports | Reports |
| Accounting | accounting | Accounting |
| Sms, ICTCore, Message, Template, Cronjob | messaging, jobs/paymentReminder | Messaging |

`app/Support/*` (Billing, PriceList, ShareCalculator, DoctorSchedule, LabOrder, Telemedicine, PaymentModes, Branch, StaffLogin …)
became `backend/src/support/*` with the same rules (most-specific share rule wins, price fallback to list price, clinic-hours and clash checks, …).

## Database
`backend/db/schema.sql` is produced by `tools/gen-schema.js`, which replays every migration's `up()`:
legacy varchar date columns become `DATE`/`TIMESTAMP` (as `SchemaModerniser` did), the foreign keys from `SchemaModerniser::RELATIONS`
are added, and the school-era tables removed by `SchoolTableRemover` are not created. JSON columns stay `TEXT` holding JSON, like the Laravel casts.
Dates and timestamps are returned to the API as plain strings so nothing shifts timezone.

## Known differences (please read)
* **Not a literal line-by-line port.** Blade/PHP idioms were re-expressed in React/Express rather than transliterated; behaviour was matched controller by controller.
* **Browser coverage.** The API has automated tests against PostgreSQL; the React screens were smoke-tested in jsdom (all load with real data) but not clicked through in a real browser – do a manual pass.
* **Not ported:** `DemoDataSeeder` (replaced by a small `seed-demo.js`), Passport OAuth API (`routes/api.php` was only the default user route), webcam capture widget in the patient form (the API accepts `photo_data` base64; the form offers file upload), the legacy school-era `feesController` routes (no controller exists), and ICTCore voice-recording transcoding with `sox` (recordings are stored; uploading audio to ICTCore must be done in ICTCore).
* **Printouts** (invoice, prescription, lab report, token, card, wristband) are print-styled React pages (`window.print()`) instead of DomPDF files; barcodes are drawn client-side (CODE 128).
* **Gateway secrets** are write-only in the UI (the API never returns them).
* Telenor/ICTCore/BizSMS integrations are ported as HTTP clients but could not be exercised without those accounts.
