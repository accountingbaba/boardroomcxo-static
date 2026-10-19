import { renderHub } from '../_moves/public.js';
export const onRequestGet = ({ env, next }) => (env.MOVES_DB ? renderHub(env) : next());
