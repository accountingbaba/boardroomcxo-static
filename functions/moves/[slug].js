import { renderProfile } from '../_moves/public.js';
export const onRequestGet = ({ env, params, next }) => (env.MOVES_DB ? renderProfile(env, String(params.slug)) : next());
