import { useEffect } from 'react';

const fallbackSiteUrl = 'https://orkestrix.site';

type PageMeta = {
  title: string;
  description: string;
  path: string;
  robots?: string;
};

function setMeta(selector: string, attribute: 'name' | 'property', value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, selector.match(/="([^"]+)/)?.[1] ?? '');
    document.head.appendChild(element);
  }
  element.content = value;
}

export function usePageMeta({ title, description, path, robots = 'index, follow' }: PageMeta) {
  useEffect(() => {
    let active = true;
    const apply = (siteUrl: string, socialImage: string) => {
    const url = `${siteUrl.replace(/\/$/, '')}${path}`;
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.title = title;
    setMeta('meta[name="description"]', 'name', description);
    setMeta('meta[name="robots"]', 'name', robots);
    setMeta('meta[property="og:title"]', 'property', title);
    setMeta('meta[property="og:description"]', 'property', description);
    setMeta('meta[property="og:url"]', 'property', url);
    setMeta('meta[property="og:image"]', 'property', new URL(socialImage, siteUrl).toString());
    setMeta('meta[name="twitter:title"]', 'name', title);
    setMeta('meta[name="twitter:description"]', 'name', description);
    setMeta('meta[name="twitter:image"]', 'name', new URL(socialImage, siteUrl).toString());

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
    };
    apply(fallbackSiteUrl, '/orkestrix-mark.png');
    fetch('/api/public/settings', { headers: { Accept: 'application/json' } }).then((response) => response.ok ? response.json() : null).then((result) => {
      if (!active || !result?.data) return;
      apply(typeof result.data.domain === 'string' ? result.data.domain : fallbackSiteUrl, typeof result.data.defaultSocialImage === 'string' ? result.data.defaultSocialImage : '/orkestrix-mark.png');
    }).catch(() => undefined);
    return () => { active = false; };
  }, [description, path, robots, title]);
}
