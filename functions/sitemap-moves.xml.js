import { renderSitemap, guard } from './_moves/public.js';
export const onRequestGet = guard(({ env, next }) => (env.MOVES_DB ? renderSitemap(env) : next()));
export const onRequestHead = onRequestGet;
