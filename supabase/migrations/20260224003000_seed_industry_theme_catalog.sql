-- Seed operational theme catalog + versions for all supported template industries.
-- Idempotent and safe for re-runs.

BEGIN;

WITH theme_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'personal-brand'::text,
        'Personal Brand'::text,
        'Operational theme for personal brands and creator-led businesses.'::text,
        'You are the Gemini Orchestrator for a personal-brand business. Prioritize authentic founder storytelling, transparent behind-the-scenes context, clear educational value, and trust-building calls-to-action. Keep outputs human, relatable, and conversion-aware without sounding corporate.'::text,
        'Personal Brand & Creator Economy'::text,
        'Authentic, conversational, inspiring, and transparent.'::text,
        'Followers, fellow creators, developers, and potential clients.'::text,
        'Minimalist, portrait-focused, warm natural lighting, and clean typography.'::text,
        ARRAY['Behind the Scenes', 'Industry Insights', 'Tutorials', 'Personal Milestones']::text[]
      ),
      (
        'ecommerce'::text,
        'E-Commerce'::text,
        'Operational theme for online retail and direct-to-consumer stores.'::text,
        'You are the Gemini Orchestrator for an ecommerce brand. Prioritize product clarity, shopper intent, merchandising angles, social proof, urgency windows, and frictionless checkout messaging. Produce concise, persuasive, high-conversion output that remains brand-safe and accurate.'::text,
        'E-Commerce & Retail'::text,
        'Persuasive, trendy, concise, and FOMO-driven.'::text,
        'Online shoppers, trend-followers, and consumer buyers.'::text,
        'High-fashion aesthetic, bright studio lighting, minimalist product shots, and lifestyle context.'::text,
        ARRAY['Product Spotlight', 'Styling Guides', 'New Arrivals', 'Seasonal Sales']::text[]
      ),
      (
        'nonprofit'::text,
        'Nonprofit'::text,
        'Operational theme for nonprofit organizations and community initiatives.'::text,
        'You are the Gemini Orchestrator for a nonprofit organization. Prioritize mission impact, donor trust, community evidence, responsible storytelling, and ethically framed fundraising asks. Keep language empathetic, factual, and action-oriented while honoring dignity and transparency.'::text,
        'Nonprofit & Charity Organization'::text,
        'Empathetic, inspiring, urgent, and deeply human.'::text,
        'Donors, volunteers, community members, and philanthropic partners.'::text,
        'Documentary-style photography, emotional portraits, earthy tones, and hopeful lighting.'::text,
        ARRAY['Impact Stories', 'Campaign Updates', 'Volunteer Spotlights', 'Educational Awareness']::text[]
      ),
      (
        'creative-agency'::text,
        'Creative Agency'::text,
        'Operational theme for creative agencies and design studios.'::text,
        'You are the Gemini Orchestrator for a creative agency. Prioritize differentiated creative strategy, portfolio proof, strong narrative hooks, and premium positioning. Outputs should feel bold, modern, and concept-driven while staying clear enough for business stakeholders.'::text,
        'Creative Agency & Design Studio'::text,
        'Edgy, innovative, bold, confident, and highly aesthetic.'::text,
        'Marketing directors, founders, and creative peers seeking top-tier design.'::text,
        'Vibrant, high-contrast, edgy typography, dynamic compositions, and award-winning design aesthetics.'::text,
        ARRAY['Design Philosophy', 'Case Studies', 'Industry Trends', 'Studio Culture']::text[]
      ),
      (
        'restaurant'::text,
        'Restaurant'::text,
        'Operational theme for restaurants and hospitality businesses.'::text,
        'You are the Gemini Orchestrator for a restaurant brand. Prioritize sensory menu storytelling, local relevance, reservation-driving copy, and event-led promotion. Keep tone warm and appetizing, with concise offers, clear availability, and compelling culinary detail.'::text,
        'Restaurant & Culinary Hospitality'::text,
        'Sensory, warm, inviting, and passionately descriptive.'::text,
        'Foodies, local diners, and culinary enthusiasts.'::text,
        'Cinematic food photography, moody ambient lighting, rich colors, and close-up textures.'::text,
        ARRAY['Seasonal Menus', 'Ingredient Sourcing', 'Chef''s Notes', 'Event Highlights']::text[]
      ),
      (
        'saas-product'::text,
        'SaaS Product'::text,
        'Operational theme for B2B SaaS products and technology startups.'::text,
        'You are the Gemini Orchestrator for a SaaS product. Prioritize user outcomes, product-led growth, feature-to-value translation, technical credibility, and adoption metrics. Produce crisp, structured output that helps prospects evaluate, onboard, and expand usage.'::text,
        'B2B SaaS & Tech Startups'::text,
        'Instructional, authoritative, tech-savvy, clear, and product-led.'::text,
        'Founders, product managers, software engineers, and B2B buyers.'::text,
        'Modern, minimal dashboard screenshots, abstract 3D shapes, clean typography, and gradient tech elements.'::text,
        ARRAY['Product Updates', 'Engineering Deep Dives', 'Growth Hacks', 'Customer Success Stories']::text[]
      ),
      (
        'facility-services'::text,
        'Facility Services'::text,
        'Operational theme for commercial cleaning and facility management providers.'::text,
        'You are the Gemini Orchestrator for facility-services operations. Prioritize compliance confidence, SLA reliability, hygiene outcomes, and B2B procurement clarity. Keep messaging professional, measurable, and risk-aware with clear service scopes and accountability.'::text,
        'Commercial Cleaning & Facility Management'::text,
        'Professional, analytical, highly reliable, and B2B-focused.'::text,
        'Office managers, facility directors, and commercial property owners.'::text,
        'Crisp corporate photography, professional cleaning staff in uniform, sparkling clean office environments, and blue-tinted trust visuals.'::text,
        ARRAY['Workplace Hygiene', 'B2B Service Standards', 'Sustainability in Cleaning', 'Health & Safety Checklists']::text[]
      )
  ) AS t(
    theme_key,
    name,
    description,
    ai_system_context,
    industry,
    brand_voice,
    target_audience,
    visual_style,
    content_pillars
  )
),
upsert_catalog AS (
  INSERT INTO public.theme_catalog (theme_key, name, description, is_active, metadata)
  SELECT
    ts.theme_key,
    ts.name,
    ts.description,
    true,
    jsonb_build_object(
      'seed', true,
      'source', 'seed_industry_theme_catalog',
      'industry', ts.industry
    )
  FROM theme_seed ts
  ON CONFLICT (theme_key) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = true,
    metadata = COALESCE(public.theme_catalog.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now()
  RETURNING id, theme_key
),
resolved_themes AS (
  SELECT
    tc.id AS theme_id,
    ts.theme_key,
    ts.ai_system_context,
    ts.industry,
    ts.brand_voice,
    ts.target_audience,
    ts.visual_style,
    ts.content_pillars
  FROM theme_seed ts
  JOIN public.theme_catalog tc ON tc.theme_key = ts.theme_key
)
UPDATE public.theme_versions tv
SET
  is_default = false,
  updated_at = now()
FROM resolved_themes rt
WHERE tv.theme_id = rt.theme_id
  AND tv.version <> '1.0.0'
  AND tv.is_default = true;

WITH theme_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'personal-brand'::text,
        'You are the Gemini Orchestrator for a personal-brand business. Prioritize authentic founder storytelling, transparent behind-the-scenes context, clear educational value, and trust-building calls-to-action. Keep outputs human, relatable, and conversion-aware without sounding corporate.'::text,
        'Personal Brand & Creator Economy'::text,
        'Authentic, conversational, inspiring, and transparent.'::text,
        'Followers, fellow creators, developers, and potential clients.'::text,
        'Minimalist, portrait-focused, warm natural lighting, and clean typography.'::text,
        ARRAY['Behind the Scenes', 'Industry Insights', 'Tutorials', 'Personal Milestones']::text[]
      ),
      (
        'ecommerce'::text,
        'You are the Gemini Orchestrator for an ecommerce brand. Prioritize product clarity, shopper intent, merchandising angles, social proof, urgency windows, and frictionless checkout messaging. Produce concise, persuasive, high-conversion output that remains brand-safe and accurate.'::text,
        'E-Commerce & Retail'::text,
        'Persuasive, trendy, concise, and FOMO-driven.'::text,
        'Online shoppers, trend-followers, and consumer buyers.'::text,
        'High-fashion aesthetic, bright studio lighting, minimalist product shots, and lifestyle context.'::text,
        ARRAY['Product Spotlight', 'Styling Guides', 'New Arrivals', 'Seasonal Sales']::text[]
      ),
      (
        'nonprofit'::text,
        'You are the Gemini Orchestrator for a nonprofit organization. Prioritize mission impact, donor trust, community evidence, responsible storytelling, and ethically framed fundraising asks. Keep language empathetic, factual, and action-oriented while honoring dignity and transparency.'::text,
        'Nonprofit & Charity Organization'::text,
        'Empathetic, inspiring, urgent, and deeply human.'::text,
        'Donors, volunteers, community members, and philanthropic partners.'::text,
        'Documentary-style photography, emotional portraits, earthy tones, and hopeful lighting.'::text,
        ARRAY['Impact Stories', 'Campaign Updates', 'Volunteer Spotlights', 'Educational Awareness']::text[]
      ),
      (
        'creative-agency'::text,
        'You are the Gemini Orchestrator for a creative agency. Prioritize differentiated creative strategy, portfolio proof, strong narrative hooks, and premium positioning. Outputs should feel bold, modern, and concept-driven while staying clear enough for business stakeholders.'::text,
        'Creative Agency & Design Studio'::text,
        'Edgy, innovative, bold, confident, and highly aesthetic.'::text,
        'Marketing directors, founders, and creative peers seeking top-tier design.'::text,
        'Vibrant, high-contrast, edgy typography, dynamic compositions, and award-winning design aesthetics.'::text,
        ARRAY['Design Philosophy', 'Case Studies', 'Industry Trends', 'Studio Culture']::text[]
      ),
      (
        'restaurant'::text,
        'You are the Gemini Orchestrator for a restaurant brand. Prioritize sensory menu storytelling, local relevance, reservation-driving copy, and event-led promotion. Keep tone warm and appetizing, with concise offers, clear availability, and compelling culinary detail.'::text,
        'Restaurant & Culinary Hospitality'::text,
        'Sensory, warm, inviting, and passionately descriptive.'::text,
        'Foodies, local diners, and culinary enthusiasts.'::text,
        'Cinematic food photography, moody ambient lighting, rich colors, and close-up textures.'::text,
        ARRAY['Seasonal Menus', 'Ingredient Sourcing', 'Chef''s Notes', 'Event Highlights']::text[]
      ),
      (
        'saas-product'::text,
        'You are the Gemini Orchestrator for a SaaS product. Prioritize user outcomes, product-led growth, feature-to-value translation, technical credibility, and adoption metrics. Produce crisp, structured output that helps prospects evaluate, onboard, and expand usage.'::text,
        'B2B SaaS & Tech Startups'::text,
        'Instructional, authoritative, tech-savvy, clear, and product-led.'::text,
        'Founders, product managers, software engineers, and B2B buyers.'::text,
        'Modern, minimal dashboard screenshots, abstract 3D shapes, clean typography, and gradient tech elements.'::text,
        ARRAY['Product Updates', 'Engineering Deep Dives', 'Growth Hacks', 'Customer Success Stories']::text[]
      ),
      (
        'facility-services'::text,
        'You are the Gemini Orchestrator for facility-services operations. Prioritize compliance confidence, SLA reliability, hygiene outcomes, and B2B procurement clarity. Keep messaging professional, measurable, and risk-aware with clear service scopes and accountability.'::text,
        'Commercial Cleaning & Facility Management'::text,
        'Professional, analytical, highly reliable, and B2B-focused.'::text,
        'Office managers, facility directors, and commercial property owners.'::text,
        'Crisp corporate photography, professional cleaning staff in uniform, sparkling clean office environments, and blue-tinted trust visuals.'::text,
        ARRAY['Workplace Hygiene', 'B2B Service Standards', 'Sustainability in Cleaning', 'Health & Safety Checklists']::text[]
      )
  ) AS t(theme_key, ai_system_context, industry, brand_voice, target_audience, visual_style, content_pillars)
),
resolved AS (
  SELECT
    tc.id AS theme_id,
    ts.theme_key,
    ts.ai_system_context,
    ts.industry,
    ts.brand_voice,
    ts.target_audience,
    ts.visual_style,
    ts.content_pillars
  FROM theme_seed ts
  JOIN public.theme_catalog tc ON tc.theme_key = ts.theme_key
)
INSERT INTO public.theme_versions (theme_id, version, status, config, is_default, released_at)
SELECT
  r.theme_id,
  '1.0.0',
  'active',
  jsonb_build_object(
    'legacy_template_id', r.theme_key,
    'config_schema', jsonb_build_object(
      'version', '1.0',
      'ai_system_context', r.ai_system_context,
      'industry', r.industry
    ),
    'modules_manifest', jsonb_build_object(
      'version', '1.0',
      'default_modules', jsonb_build_array('hero', 'content', 'offers', 'cta'),
      'ai_system_context', r.ai_system_context
    ),
    'aiContext', jsonb_build_object(
      'industry', r.industry,
      'brandVoice', r.brand_voice,
      'targetAudience', r.target_audience,
      'contentPillars', to_jsonb(r.content_pillars),
      'visualStyle', r.visual_style
    )
  ),
  true,
  now()
FROM resolved r
ON CONFLICT (theme_id, version)
DO UPDATE SET
  status = EXCLUDED.status,
  config = EXCLUDED.config,
  is_default = EXCLUDED.is_default,
  released_at = COALESCE(public.theme_versions.released_at, EXCLUDED.released_at),
  updated_at = now();

COMMIT;

