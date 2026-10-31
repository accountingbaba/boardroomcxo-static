import { renderSitemap } from './_moves/public.js';
export const onRequestGet = ({ env, next }) => (env.MOVES_DB ? renderSitemap(env) : next());
