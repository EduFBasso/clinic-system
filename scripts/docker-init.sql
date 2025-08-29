-- Initialize local roles and db deterministically
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clinic') THEN
      CREATE ROLE clinic WITH LOGIN PASSWORD 'clinicpass';
   END IF;
END$$;

-- Ensure database exists and owned by clinic
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'clinic_local') THEN
      CREATE DATABASE clinic_local OWNER clinic;
   END IF;
END$$;

GRANT ALL PRIVILEGES ON DATABASE clinic_local TO clinic;
