-- White-label appearance settings, edited in Admin > Appearance.
INSERT IGNORE INTO `SystemSetting` (`key`, `value`, `group`, `type`, `updatedAt`) VALUES
  ('platform.name', 'Cavendish Connect', 'branding', 'string', CURRENT_TIMESTAMP(3)),
  ('brand.university_name', 'Cavendish University Uganda', 'branding', 'string', CURRENT_TIMESTAMP(3)),
  ('brand.university_short', 'Cavendish', 'branding', 'string', CURRENT_TIMESTAMP(3)),
  ('brand.location', 'Kampala, Uganda', 'branding', 'string', CURRENT_TIMESTAMP(3)),
  ('brand.primary_color', '#1442a3', 'branding', 'color', CURRENT_TIMESTAMP(3)),
  ('brand.accent_color', '#ffc81f', 'branding', 'color', CURRENT_TIMESTAMP(3)),
  ('brand.logo_url', '', 'branding', 'image', CURRENT_TIMESTAMP(3)),
  ('brand.hero_market', '/images/campus-hero.jpg', 'branding', 'image', CURRENT_TIMESTAMP(3)),
  ('brand.hero_services', '/images/campus-hero.jpg', 'branding', 'image', CURRENT_TIMESTAMP(3)),
  ('brand.hero_stays', '/images/stays-hero-alt.jpg', 'branding', 'image', CURRENT_TIMESTAMP(3)),
  ('seo.description', 'The official campus marketplace, services hub and student accommodation platform for Cavendish University Uganda. Buy, sell, hire and find a room from verified members.', 'branding', 'text', CURRENT_TIMESTAMP(3));

-- platform.name and the tagline now live with the other appearance settings.
UPDATE `SystemSetting` SET `group` = 'branding' WHERE `key` IN ('platform.name', 'platform.tagline');
