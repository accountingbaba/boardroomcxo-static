import { renderHub, guard } from '../_moves/public.js';
export const onRequestGet = guard(({ env, request, next }) => (env.MOVES_DB ? renderHub(env, request) : next()));
export const onRequestHead = onRequestGet;
