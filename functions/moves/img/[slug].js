import { serveProfileImage, guard } from '../../_moves/public.js';
export const onRequestGet = guard(({ env, params, next }) => (env.MOVES_DB ? serveProfileImage(env, String(params.slug)) : next()));
export const onRequestHead = onRequestGet;
