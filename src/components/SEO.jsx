import { Helmet } from 'react-helmet-async'

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
  const defaultTitle = 'Vizag Jobs | Latest Jobs in Visakhapatnam'
  const defaultDescription = 'Find latest jobs in Vizag including IT jobs, fresher jobs, part-time jobs and private jobs in Visakhapatnam.'
  const defaultKeywords = 'Vizag Jobs, Jobs in Vizag, Visakhapatnam Jobs, IT Jobs Vizag, Fresher Jobs Vizag'
  const baseUrl = 'https://jobsinvizag.in'

  const finalTitle = title || defaultTitle
  const finalDescription = description || defaultDescription
  const finalKeywords = keywords || defaultKeywords
  const finalCanonical = canonical ? `${baseUrl}${canonical}` : baseUrl
  const finalOgTitle = ogTitle || finalTitle
  const finalOgDescription = ogDescription || finalDescription
  const finalOgUrl = ogUrl ? `${baseUrl}${ogUrl}` : finalCanonical
  const finalTwitterTitle = twitterTitle || finalOgTitle
  const finalTwitterDescription = twitterDescription || finalOgDescription

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      <link rel="canonical" href={finalCanonical} />

      {/* Open Graph */}
      <meta property="og:title" content={finalOgTitle} />
      <meta property="og:description" content={finalOgDescription} />
      <meta property="og:url" content={finalOgUrl} />
      <meta property="og:type" content="website" />
      {ogImage && <meta property="og:image" content={ogImage} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={finalTwitterTitle} />
      <meta name="twitter:description" content={finalTwitterDescription} />
      {twitterImage && <meta name="twitter:image" content={twitterImage} />}

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