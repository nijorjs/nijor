export function getRoute(filepath) {
  filepath = filepath.replace(/\\/g, '/');
  let route = '/' + filepath.split('src/pages/')[1].replace('.nijor', '');
  if (route.endsWith('/') && route != "/") route = route.substring(0, route.length - 1);
  const fragments = route.split('/');
  const lastFragment = fragments[fragments.length - 1];
  let url = '';

  if (fragments.length > 1 && lastFragment === "index") fragments.pop();
  url = fragments.join('/') || '/';

  return url;
}