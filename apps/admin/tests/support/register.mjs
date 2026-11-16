process.env.NODE_ENV = 'test';
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
