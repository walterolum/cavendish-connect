import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        roles: string[];
      };
    }

    interface ParamsDictionary {
      [key: string]: string;
    }
  }
}

export {};