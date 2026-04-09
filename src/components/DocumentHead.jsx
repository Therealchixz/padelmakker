import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { absoluteUrl } from '../lib/siteMeta'

const DEFAULT_DESC =
  'Find padel-makkere, book baner og track din ELO-ranking. Danmarks padel-platform — gratis profil.'

/** @type {Record<string, { title: string; description?: string }>} */
const ROUTE_META = {
  '/': {
    title: 'PadelMakker — Find makker. Book bane. Spil padel.',
    description: DEFAULT_DESC,
  },
  '/login': {
    title: 'Log ind | PadelMakker',
    description: 'Log ind på PadelMakker med email og adgangskode.',
  },
  '/opret': {
    title: 'Opret profil | PadelMakker',
    description: 'Opret gratis padel-profil — niveau, region, makkersøgning og baner.',
  },
  '/events': {
    title: 'Kommende events og Americano | PadelMakker',
    description: 'Se kommende Americano-turneringer på PadelMakker. Log ind for at tilmelde dig.',
  },
  '/om': {
    title: 'Om PadelMakker',
    description: 'Hvad PadelMakker er: makkere, kampe, ELO, Americano og baner-overblik i Danmark.',
  },
  '/faq': {
    title: 'Ofte stillede spørgsmål | PadelMakker',
    description: 'FAQ om PadelMakker: pris, ELO, booking af baner, regioner og konto.',
  },
  '/elo': {
    title: 'Sådan virker ELO | PadelMakker',
    description:
      'Forklaring af ELO på PadelMakker: bekræftede 2v2-kampe, forventet udfald, K-faktor, sejrsmargin og Americano.',
  },
  '/privatlivspolitik': {
    title: 'Privatlivspolitik | PadelMakker',
    description: 'Sådan behandler PadelMakker personoplysninger.',
  },
  '/handelsbetingelser': {
    title: 'Handelsbetingelser | PadelMakker',
    description: 'Vilkår for brug af PadelMakker.',
  },
  '/cookies': {
    title: 'Cookies og lokal lagring | PadelMakker',
    description: 'Information om cookies, localStorage og PWA på PadelMakker.',
  },
  '/hjaelp': {
    title: 'Hjælp og kontakt | PadelMakker',
    description: 'Kontakt PadelMakker, svartid og links til FAQ, app-installation og events.',
  },
  '/app': {
    title: 'Installér PadelMakker på telefonen | PadelMakker',
    description: 'Sådan tilføjer du PadelMakker til hjemmeskærmen på iPhone og Android (PWA).',
  },
}

function setMetaByName(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setMetaByProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Opdaterer &lt;title&gt;, meta description, canonical og grundlæggende Open Graph pr. route (SPA).
 */
export function DocumentHead() {
  const { pathname } = useLocation()
  const meta = ROUTE_META[pathname] || ROUTE_META['/']
  const description = meta.description || DEFAULT_DESC
  const url = absoluteUrl(pathname)

  useEffect(() => {
    document.title = meta.title
    setMetaByName('description', description)
    setCanonical(url)
    setMetaByProperty('og:title', meta.title)
    setMetaByProperty('og:description', description)
    setMetaByProperty('og:url', url)
    setMetaByProperty('og:type', 'website')
    setMetaByProperty('og:locale', 'da_DK')
    const ogImage = absoluteUrl('/icon-512.png')
    setMetaByProperty('og:image', ogImage)
    setMetaByName('twitter:card', 'summary_large_image')
  }, [pathname, meta.title, description, url])

  return null
}
