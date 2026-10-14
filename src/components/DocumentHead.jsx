import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { absoluteUrl } from '../lib/siteMeta'

const DEFAULT_DESC =
  'Find padelspillere på dit niveau, opret kampe, se ledige baner og følg både 2v2-ELO og separat Turnerings-ELO (Americano/Mexicano). PadelMakker er en dansk padel-platform med gratis profil.'

const ORGANIZATION_LOGO_PATH = '/icon-512-v2.png'
const ORGANIZATION_LOGO_WIDTH = 512
const ORGANIZATION_LOGO_HEIGHT = 512

/** @type {Record<string, { title: string; description?: string }>} */
const ROUTE_META = {
  '/': {
    title: 'PadelMakker | Find padelmakker på dit niveau',
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
  '/opret/bekraeft-email': {
    title: 'Tjek din e-mail | PadelMakker',
    description:
      'Bekræft din e-mail for at færdiggøre oprettelsen af din PadelMakker-profil. Linket i mailen udløber efter 24 timer.',
  },
  '/opret/bekraeft-telefon': {
    title: 'Bekræft telefonnummer | PadelMakker',
    description:
      'Bekræft dit telefonnummer med SMS-kode for at afslutte sikkerhedsflowet ved oprettelse.',
  },
  '/events': {
    title: 'Kommende events og turneringer | PadelMakker',
    description: 'Se kommende Americano- og Mexicano-turneringer på PadelMakker. Log ind for at tilmelde dig.',
  },
  '/om': {
    title: 'Om PadelMakker',
    description: 'Hvad PadelMakker er: makkere, kampe, 2v2-ELO, separat Turnerings-ELO og baner-overblik i Danmark.',
  },
  '/faq': {
    title: 'Ofte stillede spørgsmål | PadelMakker',
    description: 'FAQ om PadelMakker: pris, 2v2-ELO, Turnerings-ELO, booking af baner, regioner og konto.',
  },
  '/elo': {
    title: 'Sådan virker ELO | PadelMakker',
    description:
      'Forklaring af ELO på PadelMakker: individuel forventning mod modstanderholdets snit, dynamisk K pr. spiller, sejrsmargin og separat Turnerings-ELO.',
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
  '/kampagne/forste-200': {
    title: 'Kampagne for de første 200 | PadelMakker',
    description: 'Regler for PadelMakkers kampagne for de første 200 spillere.',
  },
  '/afmeld': {
    title: 'Afmeld mails | PadelMakker',
    description: 'Afmeld mails fra PadelMakker med ét klik.',
  },
  '/profil/fuldfoer': {
    title: 'Færdiggør din profil | PadelMakker',
    description: 'Udfyld det, der mangler på din PadelMakker-profil.',
  },
}

/*
 * Sider med et id i adressen (/kamp/123) og selve appen. Kamp- og turneringssiden
 * sætter selv en mere præcis titel, når data er hentet.
 */
const PREFIX_META = [
  ['/kamp/', { title: 'Padelkamp | PadelMakker', description: 'Se kampen og find med på PadelMakker.' }],
  ['/turnering/', { title: 'Padelturnering | PadelMakker', description: 'Se turneringen og tilmeld dig på PadelMakker.' }],
  ['/dashboard', { title: 'PadelMakker' }],
]

/** Ukendte adresser skal ikke ligne forsiden (ellers indekseres de som den). */
const NOT_FOUND_META = {
  title: 'Siden findes ikke | PadelMakker',
  description: 'Siden findes ikke. Gå til forsiden af PadelMakker.',
}

export function metaForPath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (ROUTE_META[path]) return ROUTE_META[path]
  const hit = PREFIX_META.find(([prefix]) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))
  return hit ? hit[1] : NOT_FOUND_META
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

function setJsonLd(id, data) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function buildStructuredData() {
  const siteUrl = absoluteUrl('/')
  const logoUrl = absoluteUrl(ORGANIZATION_LOGO_PATH)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'PadelMakker',
        alternateName: 'Padel Makker',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: logoUrl,
          contentUrl: logoUrl,
          encodingFormat: 'image/png',
          width: ORGANIZATION_LOGO_WIDTH,
          height: ORGANIZATION_LOGO_HEIGHT,
        },
      },
      {
        '@type': 'WebSite',
        name: 'PadelMakker',
        url: siteUrl,
        inLanguage: 'da-DK',
        description: DEFAULT_DESC,
        publisher: {
          '@type': 'Organization',
          name: 'PadelMakker',
          url: siteUrl,
        },
        potentialAction: {
          '@type': 'RegisterAction',
          target: absoluteUrl('/opret'),
          name: 'Opret gratis profil',
        },
      },
    ],
  }
}

/**
 * Opdaterer &lt;title&gt;, meta description, canonical og grundlæggende Open Graph pr. route (SPA).
 */
export function DocumentHead() {
  const { pathname } = useLocation()
  const meta = metaForPath(pathname)
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
    setMetaByProperty('og:site_name', 'PadelMakker')
    const ogImage = absoluteUrl('/icon-512-v2.png')
    setMetaByProperty('og:image', ogImage)
    setMetaByName('twitter:card', 'summary_large_image')
    setMetaByName('twitter:title', meta.title)
    setMetaByName('twitter:description', description)
    setJsonLd('pm-structured-data', buildStructuredData())
  }, [pathname, meta.title, description, url])

  return null
}

