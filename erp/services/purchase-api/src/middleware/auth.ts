import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config/env';

const client = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
  cache: true,
  rateLimit: true,
});

function getKey(header: jwt.JwtHeader, cb: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid!, (err, key) => {
    if (err) { cb(err); return; }
    cb(null, key?.getPublicKey());
  });
}

declare global {
  namespace Express {
    interface Request {
      userId:   string;
      userUpn:  string;
      userName: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'No token provided' }); return; }

  const unverified = jwt.decode(token, { complete: true });
  console.log('[auth] header:', JSON.stringify(unverified?.header));
  console.log('[auth] aud:', (unverified?.payload as jwt.JwtPayload)?.aud);
  console.log('[auth] iss:', (unverified?.payload as jwt.JwtPayload)?.iss);

  jwt.verify(token, getKey, {
    audience: `api://${config.AZURE_CLIENT_ID}`,
    algorithms: ['RS256'],
  }, (err, decoded) => {
    if (err) {
      console.error('[auth] token rejected:', err.message);
      res.status(401).json({ error: 'Invalid token', detail: err.message });
      return;
    }
    const payload = decoded as jwt.JwtPayload;
    req.userId   = payload.oid  ?? '';
    req.userUpn  = payload.upn  ?? payload.preferred_username ?? '';
    req.userName = payload.name ?? '';
    next();
  });
}
