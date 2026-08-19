import { absoluteUrl } from './siteMeta';

/** @param {{ title: string; description: string; pathname: string }} meta */
export function applyPublicShareMeta(meta) {
  if (typeof document === 'undefined') return;
  document.title = meta.title;
  const description = meta.description;
  const url = absoluteUrl(meta.pathname);

  const setName = (name, content) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const setProp = (property, content) => {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setName('description', description);
  setProp('og:title', meta.title);
  setProp('og:description', description);
  setProp('og:url', url);
  setProp('og:type', 'website');
  setProp('og:locale', 'da_DK');
  setProp('og:site_name', 'PadelMakker');
  setProp('og:image', absoluteUrl('/icon-512-v2.png'));
  setName('twitter:card', 'summary_large_image');
  setName('twitter:title', meta.title);
  setName('twitter:description', description);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);
}
