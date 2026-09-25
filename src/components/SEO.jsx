import { Helmet } from 'react-helmet-async'
import { SITE_URL, toAbsoluteUrl } from '../lib/site'

const SEO = ({
  title,
  description,
  keywords,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  twitterCard = 'summary_large_image',
  twitterTitle,
  twitterDescription,
  twitterImage,
  structuredData
}) => {
  const defaultTitle = 'Jobs in Vizag | Latest Job Openings in Visakhapatnam'
  const defaultDescription = 'Jobs in Vizag — find the latest IT jobs, fresher jobs, part-time jobs and private jobs in Visakhapatnam. Updated daily.'
  const defaultKeywords = 'Jobs in Vizag, Vizag Jobs, Visakhapatnam Jobs, IT Jobs Vizag, Fresher Jobs Vizag'
  const siteName = 'Jobs in Vizag'
  const defaultOgImage = `${SITE_URL}/og-image.png`

  const finalTitle = title || defaultTitle
  const finalDescription = description || defaultDescription
  const finalKeywords = keywords || defaultKeywords
  const finalCanonical = canonical ? toAbsoluteUrl(canonical) : SITE_URL
  const finalOgTitle = ogTitle || finalTitle
  const finalOgDescription = ogDescription || finalDescription
  const finalOgUrl = ogUrl ? toAbsoluteUrl(ogUrl) : finalCanonical
  const finalTwitterTitle = twitterTitle || finalOgTitle
  const finalTwitterDescription = twitterDescription || finalOgDescription
  const finalOgImage = ogImage ? toAbsoluteUrl(ogImage) : defaultOgImage
  const finalTwitterImage = twitterImage ? toAbsoluteUrl(twitterImage) : finalOgImage

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      <meta name="application-name" content={siteName} />
      <link rel="canonical" href={finalCanonical} />

      {/* Open Graph */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={finalOgTitle} />
      <meta property="og:description" content={finalOgDescription} />
      <meta property="og:url" content={finalOgUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Jobs in Vizag — Find Your Career in Vizag" />

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={finalTwitterTitle} />
      <meta name="twitter:description" content={finalTwitterDescription} />
      <meta name="twitter:image" content={finalTwitterImage} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  )
}

export default SEO
