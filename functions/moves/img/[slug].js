import { serveProfileImage } from '../../_moves/public.js';
export const onRequestGet = ({ env, params, next }) => (env.MOVES_DB ? serveProfileImage(env, String(params.slug)) : next());
