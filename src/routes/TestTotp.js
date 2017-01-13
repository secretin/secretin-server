import { Router } from 'express';
import speakeasy from 'speakeasy';

import Utils from '../utils';

export default () => {
  const route = Router();
  route.get('/:seed/:otp', (req, res) => {
    const verified = speakeasy.totp.verify({
      secret: req.params.seed,
      encoding: 'base32',
      token: req.params.otp,
    });
    if (verified) {
      res.json('ok');
    } else {
      Utils.reason(res, 404, 'Invalid couple');
    }
  });

  return route;
};
