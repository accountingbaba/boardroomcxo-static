import { renderReport, guard } from '../../_moves/public.js';
export const onRequestGet = guard(({ env, params, request, next }) => (env.MOVES_DB ? renderReport(env, String(params.month || ''), request) : next()));
export const onRequestHead = onRequestGet;
