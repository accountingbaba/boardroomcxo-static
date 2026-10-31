import { renderReport } from '../../_moves/public.js';
export const onRequestGet = ({ env, params, request, next }) => (env.MOVES_DB ? renderReport(env, String(params.month || ''), request) : next());
