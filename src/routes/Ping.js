import { Router } from 'express';

export default () => {
  const route = Router();
  route.get('/', (req, res) => {
    res.json('pong');
  });

  return route;
};
