import { renderLatest, guard } from '../_moves/public.js';
// The homepage Boardroom Moves card (script.js). Works without the Moves database too, from the archive and stories.
export const onRequestGet = guard(({ env, request }) => renderLatest(env, request));
export const onRequestHead = onRequestGet;
