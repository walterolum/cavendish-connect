import prisma from '../config/database';
import crypto from 'crypto';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import { hashPassword } from '../utils/helpers';
import { paginate } from '../utils/response';
import { auditLog } from '../middleware/audit';
import { clearSettingsCache } from '../utils/settings';

export type ListingKind = 'marketplace' | 'service' | 'accommodation';

const LISTING_KINDS: Record<
  ListingKind,
  { model: string; category: string; price: string; entity: string; label: string; noun: string }
> = {
  marketplace: { model: 'marketplaceListing', category: 'category', price: 'price', entity: 'MARKETPLACE', label: 'Listing', noun: 'Listing' },
  service: { model: 'service', category: 'serviceCategory', price: 'priceMin', entity: 'SERVICE', label: 'Service', noun: 'Service' },
  accommodation: { model: 'property', category: 'propertyCategory', price: 'monthlyPrice', entity: 'ACCOMMODATION', label: 'Accommodation', noun: 'Property' },
};

const VERIFICATION_NOTICES: Record<string, { title: string; message: string }> = {
  VERIFIED: { title: "You're verified", message: 'Your profile now shows a verified badge on everything you post.' },
  REJECTED: { title: 'Verification not approved', message: 'We could not verify your request.' },
  SUSPENDED: { title: 'Verification revoked', message: 'Your verified badge has been removed.' },
  PENDING: { title: 'Verification under review', message: 'Your request is back in the review queue.' },
};

/** Readable one-time password, e.g. "Cav-7kq2-m9xp". Avoids look-alike characters. */
function generateTempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => chars[b % chars.length]).join('');
  let pwd = `Cav-${pick(4)}-${pick(4)}`;
  if (!/\d/.test(pwd)) pwd += '7';
  return pwd;
}

export class AdminService {
  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      listingsByStatus,
      totalReports,
      openReports,
      totalRevenue,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { isActive: true, isSuspended: false, deletedAt: null } }),
      prisma.marketplaceListing.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null },
      }),
      prisma.report.count(),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESSFUL' },
        _sum: { amount: true },
      }),
    ]);

    const serviceStatusCounts = await prisma.service.groupBy({
      by: ['status'],
      _count: true,
      where: { deletedAt: null },
    });

    const propertyStatusCounts = await prisma.property.groupBy({
      by: ['status'],
      _count: true,
      where: { deletedAt: null },
    });

    const pendingVerifications = await prisma.verificationRequest.count({
      where: { status: 'PENDING' },
    });

    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, username: true, firstName: true, lastName: true, email: true, createdAt: true,
      },
    });

    return {
      totalUsers,
      activeUsers,
      listings: {
        marketplace: listingsByStatus,
        services: serviceStatusCounts,
        accommodation: propertyStatusCounts,
      },
      reports: { total: totalReports, open: openReports },
      revenue: totalRevenue._sum.amount || 0,
      pendingVerifications,
      recentUsers,
    };
  }

  async listUsers(query: { page?: number; limit?: number; role?: string; search?: string; status?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (query.role) {
      where.roles = { some: { role: { name: query.role } } };
    }

    if (query.search) {
      where.OR = [
        { username: { contains: query.search } },
        { email: { contains: query.search } },
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
      ];
    }

    if (query.status === 'suspended') {
      where.isSuspended = true;
    } else if (query.status === 'active') {
      where.isActive = true;
      where.isSuspended = false;
    } else if (query.status === 'inactive') {
      where.isActive = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, username: true, firstName: true, lastName: true,
          phone: true, avatar: true, isActive: true, isSuspended: true, isEmailVerified: true,
          createdAt: true, lastLoginAt: true, mustChangePassword: true,
          roles: { include: { role: true } },
          _count: {
            select: {
              marketplaceListings: { where: { deletedAt: null } },
              services: { where: { deletedAt: null } },
              properties: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map(u => ({
      ...u,
      roles: u.roles.map(ur => ur.role.name),
    }));

    return { users: formattedUsers, meta: paginate(total, page, limit) };
  }

  /**
   * Creates an account on someone's behalf. Self sign-up is closed, so this is
   * the only way in. The person gets a one-time temporary password and must
   * choose their own the first time they sign in.
   */
  async createUser(
    actorId: number,
    input: { firstName: string; lastName: string; email: string; username: string; phone?: string; role: string }
  ) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    const [byEmail, byUsername, role] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
      prisma.role.findUnique({ where: { name: input.role } }),
    ]);
    if (byEmail) throw new ConflictError('An account with this email already exists');
    if (byUsername) throw new ConflictError('This username is already taken');
    if (!role) throw new NotFoundError('Role');

    const tempPassword = generateTempPassword();
    const user = await prisma.user.create({
      data: {
        email,
        username,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        passwordHash: await hashPassword(tempPassword),
        // The admin has vouched for this person, so no email confirmation step.
        isEmailVerified: true,
        mustChangePassword: true,
        universityAffiliation: 'Cavendish University Uganda',
        roles: { create: { roleId: role.id } },
        profile: { create: {} },
      },
      select: { id: true, email: true, username: true, firstName: true, lastName: true },
    });

    await auditLog(actorId, 'CREATE', 'USER', user.id, undefined, undefined, { email, username, role: input.role });
    return { user, tempPassword };
  }

  /** Issues a new temporary password, e.g. when someone forgets theirs. */
  async resetUserPassword(actorId: number, userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundError('User');
    if (actorId === userId) throw new BadRequestError('Use your profile page to change your own password');

    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
    });
    await auditLog(actorId, 'RESET_PASSWORD', 'USER', userId);
    return { tempPassword };
  }

  async suspendUser(actorId: number, userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');
    if (actorId === userId) throw new BadRequestError('You cannot suspend your own account');

    await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: true, suspendedAt: new Date() },
    });

    await auditLog(actorId, 'SUSPEND', 'USER', userId);

    return { message: 'User suspended' };
  }

  async activateUser(actorId: number, userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false, suspendedAt: null, suspensionReason: null, isActive: true },
    });

    await auditLog(actorId, 'ACTIVATE', 'USER', userId);

    return { message: 'User activated' };
  }

  async changeUserRole(actorId: number, userId: number, roleName: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundError('Role');
    if (actorId === userId && roleName !== 'ADMIN') {
      throw new BadRequestError('You cannot remove your own admin access');
    }

    const oldRoles = (await prisma.userRole.findMany({ where: { userId }, include: { role: true } }))
      .map(ur => ur.role.name);

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.userRole.create({ data: { userId, roleId: role.id } }),
    ]);

    await auditLog(actorId, 'UPDATE', 'USER', userId, undefined, { roles: oldRoles }, { roles: [roleName] });

    return { message: `Role changed to ${roleName}` };
  }

  /** Lists posts of one kind (marketplace, service, accommodation) in a single normalised shape. */
  async listListings(query: { page?: number; limit?: number; status?: string; search?: string; kind?: ListingKind }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;
    const kind = query.kind || 'marketplace';
    const cfg = LISTING_KINDS[kind];

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { user: { username: { contains: query.search } } },
      ];
    }

    const model = (prisma as any)[cfg.model];
    const [rows, total] = await Promise.all([
      model.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true } },
          [cfg.category]: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      model.count({ where }),
    ]);

    const listings = rows.map((r: any) => ({
      id: r.id,
      kind,
      userId: r.userId,
      title: r.title,
      slug: r.slug,
      description: r.description,
      price: r[cfg.price] ?? null,
      priceMax: kind === 'service' ? r.priceMax ?? null : null,
      priceType: kind === 'service' ? r.priceType : kind === 'accommodation' ? 'monthly' : null,
      currency: r.currency,
      location: r.location ?? null,
      status: r.status,
      viewCount: r.viewCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      image: r.images?.[0]?.url ?? null,
      user: r.user,
      category: r[cfg.category] ?? null,
    }));

    return { listings, meta: paginate(total, page, limit) };
  }

  async updateListingStatus(
    actorId: number,
    listingId: number,
    status: string,
    kind: ListingKind = 'marketplace',
    reason?: string
  ) {
    const cfg = LISTING_KINDS[kind];
    const model = (prisma as any)[cfg.model];
    const listing = await model.findUnique({ where: { id: listingId } });
    if (!listing || listing.deletedAt) throw new NotFoundError(cfg.noun);

    const data: any = { status };
    if (kind === 'marketplace' && status === 'ACTIVE' && !listing.publishedAt) data.publishedAt = new Date();
    const updated = await model.update({ where: { id: listingId }, data });

    await auditLog(
      actorId,
      'STATUS_CHANGE',
      cfg.entity,
      listingId,
      undefined,
      { status: listing.status },
      { status, ...(reason ? { reason } : {}) }
    );

    const why = reason ? ` Reason: ${reason}` : '';
    const notices: Record<string, { type: string; title: string; message: string }> = {
      ACTIVE: { type: 'LISTING_APPROVED', title: `${cfg.label} approved`, message: `"${listing.title}" has been approved and is now live.` },
      REJECTED: { type: 'LISTING_REJECTED', title: `${cfg.label} not approved`, message: `"${listing.title}" was not approved.${why}` },
      SUSPENDED: { type: 'LISTING_REJECTED', title: `${cfg.label} suspended`, message: `"${listing.title}" has been hidden by a moderator.${why}` },
    };
    const n = notices[status];
    if (n && listing.status !== status) {
      await prisma.notification.create({
        data: {
          userId: listing.userId,
          type: n.type as any,
          title: n.title,
          message: n.message,
          targetType: cfg.entity,
          targetId: listing.id,
        },
      });
    }

    return updated;
  }

  async listReports(query: { page?: number; limit?: number; status?: string; type?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.type) where.targetType = query.type;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, username: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    const targets = await this.loadReportTargets(reports);
    return {
      reports: reports.map((r) => ({ ...r, target: targets.get(`${r.targetType}:${r.targetId}`) ?? null })),
      meta: paginate(total, page, limit),
    };
  }

  /** Short summary of each reported item, so moderators can see and open it without guessing ids. */
  private async loadReportTargets(reports: { targetType: string; targetId: number }[]) {
    const ids = (type: string) => [...new Set(reports.filter((r) => r.targetType === type).map((r) => r.targetId))];
    const owner = { select: { id: true, username: true, firstName: true, lastName: true } };
    const base = { id: true, title: true, slug: true, status: true, deletedAt: true, user: owner };

    const [listings, services, properties, users, reviews] = await Promise.all([
      ids('LISTING').length ? prisma.marketplaceListing.findMany({ where: { id: { in: ids('LISTING') } }, select: base }) : [],
      ids('SERVICE').length ? prisma.service.findMany({ where: { id: { in: ids('SERVICE') } }, select: base }) : [],
      ids('ACCOMMODATION').length ? prisma.property.findMany({ where: { id: { in: ids('ACCOMMODATION') } }, select: base }) : [],
      ids('USER').length
        ? prisma.user.findMany({
            where: { id: { in: ids('USER') } },
            select: { id: true, username: true, firstName: true, lastName: true, isSuspended: true, deletedAt: true },
          })
        : [],
      ids('REVIEW').length
        ? prisma.review.findMany({
            where: { id: { in: ids('REVIEW') } },
            select: { id: true, title: true, content: true, rating: true, status: true, author: owner },
          })
        : [],
    ]);

    const map = new Map<string, any>();
    const posts: [string, ListingKind, string, any[]][] = [
      ['LISTING', 'marketplace', '/marketplace', listings],
      ['SERVICE', 'service', '/services', services],
      ['ACCOMMODATION', 'accommodation', '/accommodation', properties],
    ];
    for (const [type, kind, path, rows] of posts) {
      for (const t of rows) {
        map.set(`${type}:${t.id}`, {
          kind,
          title: t.title,
          url: t.deletedAt ? null : `${path}/${t.slug}`,
          status: t.deletedAt ? 'DELETED' : t.status,
          owner: t.user,
        });
      }
    }
    for (const u of users) {
      map.set(`USER:${u.id}`, {
        kind: 'user',
        title: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username,
        url: null,
        status: u.deletedAt ? 'DELETED' : u.isSuspended ? 'SUSPENDED' : 'ACTIVE',
        owner: { id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName },
      });
    }
    for (const r of reviews) {
      const text = r.title || r.content || '';
      map.set(`REVIEW:${r.id}`, {
        kind: 'review',
        title: `${r.rating}★ review${text ? `: "${text.length > 80 ? `${text.slice(0, 80)}…` : text}"` : ''}`,
        url: null,
        status: r.status,
        owner: r.author,
      });
    }
    return map;
  }

  async updateReportStatus(actorId: number, reportId: number, status: string, resolution?: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundError('Report');

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: status as any,
        resolution,
        reviewedBy: actorId,
        reviewedAt: new Date(),
      },
    });

    await auditLog(actorId, 'UPDATE', 'REPORT', reportId, undefined, { status: report.status }, { status });

    // Close the loop with the person who reported it.
    if ((status === 'RESOLVED' || status === 'REJECTED') && report.status !== status) {
      await prisma.notification.create({
        data: {
          userId: report.reporterId,
          type: 'REPORT_UPDATE',
          title: status === 'RESOLVED' ? 'Your report was resolved' : 'Your report was reviewed',
          message:
            status === 'RESOLVED'
              ? `Thanks for reporting. We have taken action.${resolution ? ` ${resolution}` : ''}`
              : 'Thanks for reporting. We reviewed it and found no rule was broken.',
          targetType: 'REPORT',
          targetId: report.id,
        },
      });
    }

    return updated;
  }

  async listVerifications(query: { page?: number; limit?: number; status?: string; type?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const [verifications, total] = await Promise.all([
      prisma.verificationRequest.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.verificationRequest.count({ where }),
    ]);

    return { verifications, meta: paginate(total, page, limit) };
  }

  async updateVerificationStatus(actorId: number, verificationId: number, status: string, rejectionReason?: string) {
    const verification = await prisma.verificationRequest.findUnique({ where: { id: verificationId } });
    if (!verification) throw new NotFoundError('Verification request');

    const updated = await prisma.verificationRequest.update({
      where: { id: verificationId },
      data: {
        status: status as any,
        // A fresh decision replaces any earlier reason.
        rejectionReason: status === 'VERIFIED' || status === 'PENDING' ? null : rejectionReason ?? null,
        reviewedBy: actorId,
        reviewedAt: new Date(),
      },
    });

    await auditLog(actorId, 'UPDATE', 'VERIFICATION', verificationId, undefined, { status: verification.status }, { status });

    await prisma.notification.create({
      data: {
        userId: verification.userId,
        type: 'VERIFICATION_STATUS',
        title: VERIFICATION_NOTICES[status]?.title ?? 'Verification status updated',
        message:
          (VERIFICATION_NOTICES[status]?.message ?? `Your verification request is now ${status.toLowerCase()}.`) +
          (rejectionReason && status !== 'VERIFIED' ? ` Reason: ${rejectionReason}` : ''),
        targetType: 'VERIFICATION',
        targetId: verification.id,
      },
    });

    return updated;
  }

  async getSettings() {
    return prisma.systemSetting.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  }

  async updateSettings(actorId: number, settings: { key: string; value: string }[]) {
    const existing = new Map(
      (await prisma.systemSetting.findMany({ where: { key: { in: settings.map((x) => x.key) } } })).map((x) => [x.key, x])
    );
    for (const item of settings) {
      const type = existing.get(item.key)?.type;
      const value = String(item.value).trim();
      if (type === 'number' && !/^\d+(\.\d+)?$/.test(value)) {
        throw new BadRequestError(`"${item.key}" must be a number of 0 or more`);
      }
      if (type === 'boolean' && value !== 'true' && value !== 'false') {
        throw new BadRequestError(`"${item.key}" must be on or off`);
      }
      if (item.key === 'contact.email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new BadRequestError('Support email is not a valid email address');
      }
      item.value = value;
    }

    const updates = await Promise.all(
      settings.map(s =>
        prisma.systemSetting.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value, group: 'general', type: 'string' },
        })
      )
    );

    await auditLog(
      actorId,
      'UPDATE',
      'SETTINGS',
      null,
      undefined,
      undefined,
      { keys: settings.map(s => s.key) }
    );

    clearSettingsCache();
    return updates;
  }

  async listAuditLogs(query: { page?: number; limit?: number; entity?: string; action?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.entity) where.entity = query.entity;
    if (query.action) where.action = query.action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, meta: paginate(total, page, limit) };
  }
}

export const adminService = new AdminService();
