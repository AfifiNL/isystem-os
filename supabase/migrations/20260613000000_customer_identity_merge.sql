-- Migration: 20260613000000_customer_identity_merge.sql
-- Description: Add merged_into_id column to workspace_customers for audit trailing of identity resolution.

ALTER TABLE workspace_customers
ADD COLUMN merged_into_id UUID REFERENCES workspace_customers(id) ON DELETE SET NULL;

CREATE INDEX idx_workspace_customers_merged_into ON workspace_customers(workspace_id, merged_into_id);
