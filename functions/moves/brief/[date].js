import { renderBrief } from '../../_moves/public.js';
export const onRequestGet = ({ env, params, next }) => (env.MOVES_DB ? renderBrief(env, String(params.date || '')) : next());
