import prisma from '../../config/database';
import bcrypt from 'bcryptjs';

async function createIfMissing(model: any, slug: string, data: any) {
  const existing = await model.findUnique({ where: { slug } });
  if (!existing) {
    await model.create({ data });
    return true;
  }
  return false;
}

/**
 * Safe to run on every deploy: everything is created only if missing, and
 * existing data (including the admin's password) is never overwritten.
 *
 *   SEED_DEMO       "true" adds demo students, listings, reports. Defaults to
 *                   on in development and OFF in production.
 *   ADMIN_EMAIL     first admin account's email (production: required)
 *   ADMIN_PASSWORD  first admin account's password (production: required, 10+ chars)
 */
const IS_PROD = process.env.NODE_ENV === 'production';
const DEMO = process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : !IS_PROD;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@cavconnect.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PROD ? '' : 'Admin@12345');

async function main() {
  console.log(`Starting CAV CONNECT seed (demo data: ${DEMO ? 'yes' : 'no'})...`);

  // ─── ROLES ─────────────────────────────────────────────
  console.log('Creating roles...');
  const rolesData = [
    { name: 'STUDENT', description: 'Student user with marketplace access' },
    { name: 'SERVICE_PROVIDER', description: 'Provides services to the community' },
    { name: 'LANDLORD', description: 'Provides accommodation listings' },
    { name: 'VENDOR', description: 'Business or vendor selling products' },
    { name: 'ADMIN', description: 'Platform administrator' },
  ];

  for (const role of rolesData) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // ─── ADMIN USER ────────────────────────────────────────
  console.log('Creating admin user...');
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existingAdmin && IS_PROD && (!process.env.ADMIN_EMAIL || ADMIN_PASSWORD.length < 10)) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters) to create the first admin account.');
  }
  const adminPassword = await bcrypt.hash(ADMIN_PASSWORD || 'unused-existing-admin', 12);
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      username: 'admin',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'CAV',
      isEmailVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole!.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole!.id },
  });

  await prisma.profile.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, displayName: 'CAV CONNECT Admin' },
  });

  if (DEMO) {
  // ─── DEMO STUDENTS ────────────────────────────────────
    console.log('Creating demo students...');
    const students = [
      { email: 'student1@cavconnect.com', username: 'student1', firstName: 'Alice', lastName: 'Nakato', bio: 'Computer Science student at Cavendish University Uganda' },
      { email: 'student2@cavconnect.com', username: 'student2', firstName: 'Brian', lastName: 'Okello', bio: 'Business Administration student' },
      { email: 'student3@cavconnect.com', username: 'student3', firstName: 'Grace', lastName: 'Achieng', bio: 'Law student' },
    ];

    for (const s of students) {
      const passwordHash = await bcrypt.hash('Student@12345', 12);
      const user = await prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: {
          email: s.email,
          username: s.username,
          passwordHash,
          firstName: s.firstName,
          lastName: s.lastName,
          bio: s.bio,
          location: 'Kampala, Uganda',
          universityAffiliation: 'Cavendish University Uganda',
          isEmailVerified: true,
        },
      });

      if (studentRole) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: studentRole.id } },
          update: {},
          create: { userId: user.id, roleId: studentRole.id },
        });
      }

      await prisma.profile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, displayName: `${s.firstName} ${s.lastName}` },
      });
    }

  
  }

  // ─── CATEGORIES ───────────────────────────────────────
  console.log('Creating marketplace categories...');
  const marketCategories = [
    { name: 'Phones', description: 'Smartphones, feature phones, and phone accessories.' },
    { name: 'Laptops', description: 'Laptops, notebooks, and convertible devices for study and work.' },
    { name: 'Computers', description: 'Desktops, components, and computer peripherals.' },
    { name: 'Electronics', description: 'Gadgets, audio gear, and assorted electronics.' },
    { name: 'Accessories', description: 'Cases, chargers, headphones, and gadget accessories.' },
    { name: 'Clothes', description: 'New and second-hand clothing for every season.' },
    { name: 'Shoes', description: 'Sneakers, boots, and casual footwear.' },
    { name: 'Books', description: 'Textbooks, novels, and study materials.' },
    { name: 'Stationery', description: 'Pens, notebooks, and school or office supplies.' },
    { name: 'Calculators', description: 'Scientific, graphing, and basic calculators.' },
    { name: 'Arduino kits', description: 'Arduino boards, sensors, and electronics kits.' },
    { name: 'Networking equipment', description: 'Routers, cables, adapters, and network gear.' },
    { name: 'Furniture', description: 'Desks, chairs, beds, and room furniture.' },
    { name: 'Food', description: 'Snacks, groceries, and packaged food items.' },
    { name: 'Beauty products', description: 'Cosmetics, skincare, and grooming items.' },
    { name: 'Other', description: 'Anything that does not fit another category.' },
  ];

  for (const [index, c] of marketCategories.entries()) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    await prisma.category.upsert({
      where: { slug },
      update: { description: c.description, icon: null, sortOrder: index, isActive: true },
      create: { name: c.name, slug, description: c.description, sortOrder: index },
    });
  }

  // ─── SERVICE CATEGORIES ───────────────────────────────
  console.log('Creating service categories...');
  const serviceCategories = [
    { name: 'Graphic design', description: 'Logos, posters, banners, and branding.' },
    { name: 'Video editing', description: 'Video editing, color grading, and motion graphics.' },
    { name: 'Photography', description: 'Photoshoots, event coverage, and portraits.' },
    { name: 'Web development', description: 'Websites, landing pages, and web applications.' },
    { name: 'Mobile development', description: 'Android and iOS mobile applications.' },
    { name: 'CV writing', description: 'Professional CV and cover letter writing.' },
    { name: 'Typing', description: 'Fast, accurate transcription and typing services.' },
    { name: 'Printing', description: 'Printing, photocopying, and document services.' },
    { name: 'Tutoring', description: 'Academic tutoring and exam preparation.' },
    { name: 'Social media management', description: 'Content, scheduling, and page growth.' },
    { name: 'Logo design', description: 'Custom logo design for brands and businesses.' },
    { name: 'Academic support', description: 'Assignments, research help, and study support.' },
    { name: 'Hairdressing', description: 'Haircuts, styling, and salon services.' },
    { name: 'Makeup', description: 'Makeup application for events and photoshoots.' },
    { name: 'Event services', description: 'Event planning, decor, and coordination.' },
    { name: 'Delivery', description: 'Package and food delivery services.' },
    { name: 'Other', description: 'Any other service not listed above.' },
  ];

  for (const [index, c] of serviceCategories.entries()) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    await prisma.serviceCategory.upsert({
      where: { slug },
      update: { description: c.description, icon: null, sortOrder: index, isActive: true },
      create: { name: c.name, slug, description: c.description, sortOrder: index },
    });
  }

  // ─── PROPERTY CATEGORIES ─────────────────────────────
  console.log('Creating property categories...');
  const propertyCategories = [
    { name: 'Hostel', description: 'Shared student dormitories with community living.' },
    { name: 'Single Room', description: 'Private rooms for one student.' },
    { name: 'Shared Room', description: 'Rooms shared between two or more students.' },
    { name: 'Apartment', description: 'Self-contained apartments, often furnished.' },
    { name: 'House', description: 'Full houses for students or groups.' },
    { name: 'Bedsitter', description: 'Single room with kitchenette and bathroom.' },
    { name: 'Other', description: 'Any other type of accommodation.' },
  ];
  for (const [index, c] of propertyCategories.entries()) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    await prisma.propertyCategory.upsert({
      where: { slug },
      update: { description: c.description, isActive: true },
      create: { name: c.name, slug, description: c.description },
    });
  }

  // ─── AMENITIES ────────────────────────────────────────
  console.log('Creating amenities...');
  const amenities = ['Wi-Fi', 'Water', 'Electricity', 'Security', 'Parking', 'Furnished', 'Kitchen', 'Laundry', '24/7 Access', 'Study Area'];
  for (const a of amenities) {
    await prisma.amenity.upsert({
      where: { name: a },
      update: {},
      create: { name: a },
    });
  }

  if (DEMO) {
  // ─── SAMPLE LISTINGS ──────────────────────────────────
    console.log('Creating demo marketplace listings...');
    const listingSeedUser = await prisma.user.findUnique({ where: { email: 'student1@cavconnect.com' } });
    const phoneCategory = await prisma.category.findUnique({ where: { slug: 'phones' } });
    const booksCategory = await prisma.category.findUnique({ where: { slug: 'books' } });
    const laptopCategory = await prisma.category.findUnique({ where: { slug: 'laptops' } });

    if (listingSeedUser && phoneCategory) {
      await createIfMissing(prisma.marketplaceListing, 'samsung-galaxy-a54-like-new', {
        userId: listingSeedUser.id,
        categoryId: phoneCategory.id,
        title: 'Samsung Galaxy A54 - Like New',
        slug: 'samsung-galaxy-a54-like-new',
        description: 'Selling my Samsung Galaxy A54, used for 6 months. Good condition with minor scratches on the back. Comes with original box and charger.',
        price: 850000,
        currency: 'UGX',
        condition: 'USED_GOOD',
        quantity: 1,
        location: 'Kampala',
        status: 'ACTIVE',
        isNegotiable: true,
      });
    }

    if (listingSeedUser && booksCategory) {
      await createIfMissing(prisma.marketplaceListing, 'introduction-to-algorithms-clrs-3rd-edition', {
        userId: listingSeedUser.id,
        categoryId: booksCategory.id,
        title: 'Introduction to Algorithms (CLRS) - 3rd Edition',
        slug: 'introduction-to-algorithms-clrs-3rd-edition',
        description: 'Well-maintained copy of Introduction to Algorithms. Great for computer science courses.',
        price: 120000,
        currency: 'UGX',
        condition: 'USED_GOOD',
        quantity: 1,
        location: 'Kampala',
        status: 'ACTIVE',
      });
    }

    if (listingSeedUser && laptopCategory) {
      await createIfMissing(prisma.marketplaceListing, 'hp-pavilion-laptop-i5-8gb-512gb-ssd', {
        userId: listingSeedUser.id,
        categoryId: laptopCategory.id,
        title: 'HP Pavilion Laptop i5/8GB/512GB SSD',
        slug: 'hp-pavilion-laptop-i5-8gb-512gb-ssd',
        description: 'HP Pavilion laptop in excellent condition. Core i5, 8GB RAM, 512GB SSD. Battery lasts up to 6 hours.',
        price: 1800000,
        currency: 'UGX',
        condition: 'USED_EXCELLENT',
        quantity: 1,
        location: 'Kampala',
        status: 'ACTIVE',
        isNegotiable: true,
      });
    }

  
  }

  // ─── PROMOTION PLANS ────────────────────────────────
  console.log('Creating promotion plans...');
  const plans = [
    { name: 'Featured', description: 'Appear at the top of category listings for 7 days', type: 'FEATURED' as const, price: 15000, currency: 'UGX', durationDays: 7, sortOrder: 1 },
    { name: 'Premium', description: '20x more visibility with a premium badge for 14 days', type: 'PREMIUM' as const, price: 35000, currency: 'UGX', durationDays: 14, sortOrder: 2 },
    { name: 'Sponsored', description: 'Maximum exposure in feeds and search for 30 days', type: 'SPONSORED' as const, price: 60000, currency: 'UGX', durationDays: 30, sortOrder: 3 },
    { name: 'Business Plan', description: 'Bundle for business/vendor accounts', type: 'BUSINESS_PLAN' as const, price: 100000, currency: 'UGX', durationDays: 30, sortOrder: 4 },
  ];

  for (const plan of plans) {
    const existing = await prisma.promotionPlan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.promotionPlan.create({ data: plan });
    }
  }

  if (DEMO) {
  // ─── SAMPLE SERVICES ────────────────────────────────
    console.log('Creating demo services...');
    const listingSeedUser = await prisma.user.findUnique({ where: { email: 'student1@cavconnect.com' } });
    const graphicDesignCat = await prisma.serviceCategory.findUnique({ where: { slug: 'graphic-design' } });
    const tutoringCat = await prisma.serviceCategory.findUnique({ where: { slug: 'tutoring' } });

    if (listingSeedUser && graphicDesignCat) {
      await createIfMissing(prisma.service, 'professional-logo-branding-design', {
        userId: listingSeedUser.id,
        serviceCategoryId: graphicDesignCat.id,
        title: 'Professional Logo & Branding Design',
        slug: 'professional-logo-branding-design',
        description: 'Custom logo design and branding packages for students and small businesses. Includes multiple concepts, revisions, and all source files.',
        priceMin: 80000,
        priceMax: 250000,
        priceType: 'fixed',
        currency: 'UGX',
        location: 'Kampala',
        availability: 'Weekdays 9AM - 6PM',
        status: 'ACTIVE',
      });
    }

    if (listingSeedUser && tutoringCat) {
      await createIfMissing(prisma.service, 'math-programming-tutoring', {
        userId: listingSeedUser.id,
        serviceCategoryId: tutoringCat.id,
        title: 'Math & Programming Tutoring',
        slug: 'math-programming-tutoring',
        description: 'One-on-one tutoring for mathematics, and programming languages (Python, Java, C). Available in-person around campus or online.',
        priceMin: 15000,
        priceMax: 40000,
        priceType: 'hourly',
        currency: 'UGX',
        location: 'Kampala',
        availability: 'Evenings & weekends',
        status: 'ACTIVE',
      });
    }

    // ─── SAMPLE ACCOMMODATION ──────────────────────────
    console.log('Creating demo properties...');
    const hostelCat = await prisma.propertyCategory.findUnique({ where: { slug: 'hostel' } });
    const apartmentCat = await prisma.propertyCategory.findUnique({ where: { slug: 'apartment' } });

    if (listingSeedUser && hostelCat) {
      await createIfMissing(prisma.property, 'modern-student-hostel-10-mins-from-campus', {
        userId: listingSeedUser.id,
        propertyCategoryId: hostelCat.id,
        title: 'Modern Student Hostel - 10 mins from Campus',
        slug: 'modern-student-hostel-10-mins-from-campus',
        description: 'Clean and secure hostel with study-friendly rooms, reliable power backup, and water. Single and shared rooms available.',
        propertyType: 'HOSTEL',
        location: 'Wandegeya, Kampala',
        monthlyPrice: 350000,
        depositAmount: 100000,
        currency: 'UGX',
        distanceFromCampus: '10 minutes walk',
        totalRooms: 20,
        availableRooms: 5,
        roomType: 'Single / Shared',
        isFurnished: false,
        hasWifi: true,
        hasWater: true,
        hasElectricity: true,
        hasSecurity: true,
        hasParking: false,
        status: 'ACTIVE',
      });
    }

    if (listingSeedUser && apartmentCat) {
      await createIfMissing(prisma.property, 'spacious-2-bedroom-apartment-student-friendly', {
        userId: listingSeedUser.id,
        propertyCategoryId: apartmentCat.id,
        title: 'Spacious 2-Bedroom Apartment (Student Friendly)',
        slug: 'spacious-2-bedroom-apartment-student-friendly',
        description: 'Furnished 2-bedroom apartment ideal for sharing with another student. Includes Wi-Fi, water, and 24/7 security.',
        propertyType: 'APARTMENT',
        location: 'Ntinda, Kampala',
        monthlyPrice: 1500000,
        depositAmount: 750000,
        currency: 'UGX',
        distanceFromCampus: '20 minutes drive',
        totalRooms: 3,
        availableRooms: 2,
        roomType: 'Double',
        isFurnished: true,
        hasWifi: true,
        hasWater: true,
        hasElectricity: true,
        hasSecurity: true,
        hasParking: true,
        status: 'ACTIVE',
      });
    }

  
  }

  // ─── SYSTEM SETTINGS ─────────────────────────────────
  console.log('Creating system settings...');
  const settings = [
    { key: 'platform.tagline', value: 'Connect. Buy. Sell. Serve. Find.', group: 'general', type: 'string' },
    { key: 'platform.currency', value: 'UGX', group: 'general', type: 'string' },
    { key: 'contact.email', value: 'support@cavconnect.com', group: 'general', type: 'string' },
    { key: 'contact.phone', value: '+256700000000', group: 'general', type: 'string' },
    { key: 'listing.free_limit', value: '10', group: 'listings', type: 'number' },
    { key: 'listing.free_days', value: '30', group: 'listings', type: 'number' },
    { key: 'promotion.featured_price', value: '15000', group: 'promotions', type: 'number' },
    { key: 'promotion.featured_days', value: '7', group: 'promotions', type: 'number' },
    { key: 'promotion.premium_price', value: '35000', group: 'promotions', type: 'number' },
    { key: 'promotion.premium_days', value: '14', group: 'promotions', type: 'number' },
    { key: 'promotion.sponsored_price', value: '60000', group: 'promotions', type: 'number' },
    { key: 'promotion.sponsored_days', value: '30', group: 'promotions', type: 'number' },
    { key: 'verification.student_required', value: 'true', group: 'verification', type: 'boolean' },
    { key: 'maintenance.mode', value: 'false', group: 'system', type: 'boolean' },
    { key: 'moderation.require_review', value: 'false', group: 'listings', type: 'boolean' },
    { key: 'platform.name', value: 'Cavendish Connect', group: 'general', type: 'string' },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  if (DEMO) {
  // ─── SAMPLE REPORTS ────────────────────────────────
    console.log('Creating sample reports...');
    const student1 = await prisma.user.findUnique({ where: { email: 'student1@cavconnect.com' } });
    const student2 = await prisma.user.findUnique({ where: { email: 'student2@cavconnect.com' } });
    const laptopListing = await prisma.marketplaceListing.findFirst({ where: { slug: { startsWith: 'hp-pavilion-laptop' } } });
    const tutoringService = await prisma.service.findFirst({ where: { slug: { startsWith: 'math-programming-tutoring' } } });

    if (student2 && laptopListing) {
      const existing = await prisma.report.findFirst({
        where: { reporterId: student2.id, targetType: 'LISTING', targetId: laptopListing.id },
      });
      if (!existing) {
        await prisma.report.create({
          data: {
            reporterId: student2.id,
            targetType: 'LISTING',
            targetId: laptopListing.id,
            reason: 'WRONG_INFORMATION',
            description: 'The laptop battery life is exaggerated. It barely lasts 2 hours.',
            status: 'OPEN',
          },
        });
        console.log('   + report (open) from student2');
      }
    }

    if (student1 && tutoringService) {
      const existing = await prisma.report.findFirst({
        where: { reporterId: student1.id, targetType: 'SERVICE', targetId: tutoringService.id },
      });
      if (!existing) {
        await prisma.report.create({
          data: {
            reporterId: student1.id,
            targetType: 'SERVICE',
            targetId: tutoringService.id,
            reason: 'DUPLICATE_LISTING',
            description: 'This tutoring service is advertised twice with different prices.',
            status: 'RESOLVED',
            resolution: 'Confirmed duplicate, second advertisement removed.',
            reviewedAt: new Date(),
          },
        });
        console.log('   + report (resolved) from student1');
      }
    }

    // ─── VERIFICATION REQUESTS ─────────────────────────
    console.log('Creating verification requests...');
    if (student1) {
      const existing = await prisma.verificationRequest.findFirst({
        where: { userId: student1.id, type: 'STUDENT' },
      });
      if (!existing) {
        await prisma.verificationRequest.create({
          data: {
            userId: student1.id,
            type: 'STUDENT',
            notes: 'Student ID card attached.',
            status: 'VERIFIED',
            reviewedAt: new Date(),
          },
        });
        console.log('   + verification (verified) for student1');
      }
    }

    if (student2) {
      const existing = await prisma.verificationRequest.findFirst({
        where: { userId: student2.id, type: 'STUDENT' },
      });
      if (!existing) {
        await prisma.verificationRequest.create({
          data: {
            userId: student2.id,
            type: 'STUDENT',
            notes: 'Student ID attached for verification.',
            status: 'PENDING',
          },
        });
        console.log('   + verification (pending) for student2');
      }
    }

    // ─── AUDIT LOG SAMPLES ─────────────────────────────
    console.log('Creating sample audit logs...');
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@cavconnect.com' } });
    const auditSeedTarget = await prisma.marketplaceListing.findFirst();
    if (adminUser && student1) {
      const existing = await prisma.auditLog.findFirst({
        where: { action: 'CREATE', entity: 'MARKETPLACE' },
      });
      if (!existing) {
        await prisma.auditLog.create({
          data: {
            userId: student1.id,
            action: 'CREATE',
            entity: 'MARKETPLACE',
            entityId: auditSeedTarget?.id ?? null,
            newValues: { title: 'Sample marketplace listing' },
          },
        });
        await prisma.auditLog.create({
          data: {
            userId: adminUser.id,
            action: 'UPDATE',
            entity: 'VERIFICATION',
            entityId: null,
            newValues: { note: 'Sample audit entry' },
          },
        });
        console.log('   + audit logs (2)');
      }
    }

  
  }

  console.log('Seed completed successfully!');
  if (DEMO) {
    console.log('');
    console.log('Demo credentials:');
    console.log('   Admin:  admin@cavconnect.com / Admin@12345');
    console.log('   Student: student1@cavconnect.com / Student@12345');
  } else {
    console.log(`Admin account: ${ADMIN_EMAIL}`);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
