import { renderBrief, guard } from '../../_moves/public.js';
export const onRequestGet = guard(({ env, params, next }) => (env.MOVES_DB ? renderBrief(env, String(params.date || '')) : next()));
export const onRequestHead = onRequestGet;
