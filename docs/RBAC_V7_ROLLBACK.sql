-- Operator-reviewed rollback for a database copy at exactly migration version 7.
-- Stop the application, keep a consistent backup, verify there are no newer
-- migrations, and use the matching v6 application after this rollback.
BEGIN IMMEDIATE;
DROP INDEX audit_entity_action;
DROP INDEX audit_actor_action;
ALTER TABLE settings DROP COLUMN auditor_export_allowed;
ALTER TABLE settings DROP COLUMN cashier_create_customers;
ALTER TABLE settings DROP COLUMN cashier_invoice_allocation;
DELETE FROM migrations WHERE version=7;
COMMIT;
