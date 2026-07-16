export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'www.boardroomcxo.com') {
    url.hostname = 'boardroomcxo.com';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
