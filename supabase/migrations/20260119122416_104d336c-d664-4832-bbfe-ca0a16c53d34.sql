-- Migrate existing 'logos' and 'fonts' documents to the new merged category 'logos_fonts'
UPDATE client_documents SET category = 'logos_fonts' WHERE category IN ('logos', 'fonts');