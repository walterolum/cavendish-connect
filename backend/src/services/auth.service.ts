import { pickDefined } from '../utils/helpers';
import prisma from '../config/database';
import { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/helpers';
import { AppError, BadRequestError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';

interface RegisterInput {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  async register(input: RegisterInput) {
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: input.username } });
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    const passwordHash = await hashPassword(input.password);

    const defaultRole = await prisma.role.findUnique({ where: { name: input.role || 'STUDENT' } });
    if (!defaultRole) {
      throw new AppError('Default role not found', 500);
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        roles: {
          create: {
            roleId: defaultRole.id,
          },
        },
        profile: {
          create: {},
        },
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    const roles = user.roles.map(ur => ur.role.name);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const refreshToken = generateRefreshToken({ userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        roles,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.isSuspended) {
      throw new UnauthorizedError('Account has been suspended');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = user.roles.map(ur => ur.role.name);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const refreshToken = generateRefreshToken({ userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        roles,
        mustChangePassword: user.mustChangePassword,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = verifyRefreshToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });

      if (!user || !user.isActive || user.isSuspended) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const roles = user.roles.map(ur => ur.role.name);

      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        roles,
      });

      const newRefreshToken = generateRefreshToken({ userId: user.id });

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
        profile: true,
        _count: {
          select: {
            marketplaceListings: { where: { status: 'ACTIVE', deletedAt: null } },
            services: { where: { status: 'ACTIVE', deletedAt: null } },
            properties: { where: { status: 'ACTIVE', deletedAt: null } },
            reviewsWritten: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      universityAffiliation: user.universityAffiliation,
      isEmailVerified: user.isEmailVerified,
      mustChangePassword: user.mustChangePassword,
      roles: user.roles.map(ur => ur.role.name),
      profile: user.profile,
      counts: user._count,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: number, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    location?: string;
    avatar?: string;
  }) {
    // Only these fields are user-editable; everything else (email, roles,
    // suspension, verification, password hash) is ignored.
    const changes = pickDefined(data, ['firstName', 'lastName', 'phone', 'bio', 'location', 'avatar'] as const);
    if (changes.avatar !== undefined && changes.avatar !== null && !/^(https:\/\/|\/uploads\/)/.test(changes.avatar)) {
      throw new BadRequestError('Avatar must be an uploaded image or an https URL');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: changes,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        bio: true,
        location: true,
      },
    });

    return user;
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const isPasswordValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestError('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestError('Choose a new password that is different from the current one');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: 'Password changed successfully' };
  }
}

export const authService = new AuthService();
