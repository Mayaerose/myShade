// Builds a link that opens ONE specific shade, for the brands whose website link pattern
// is shown in the data or on the brand's own site. Brands that are not listed here get no
// shade link (the page shows the shade name to pick instead), so no link is ever guessed.

const rules = {
  // MAC's own link in the data ends in ?shade=NC42, so any shade code can go there
  'M·A·C Cosmetics': (productUrl, shadeName) => {
    const url = new URL(productUrl)
    url.searchParams.set('shade', shadeName)
    return url.toString()
  },

  // Fenty has one page per shade, and the page name ends with the shade code (...-foundation-386w)
  'Fenty Beauty': (productUrl, shadeName) => {
    const base = productUrl.match(/^(.*foundation)-\d{3}[nwc]$/i)
    return base ? base[1] + '-' + shadeName.toLowerCase() : undefined
  },

  // Bobbi Brown's site picks a shade with #/shade/Name_(Code) at the end of the link
  'Bobbi Brown': (productUrl, shadeName) => {
    const clean = productUrl.split('#')[0]
    return clean + '#/shade/' + shadeName.replace(/\s+/g, '_').replace('(', '%28').replace(')', '%29')
  }
}

function shadeUrlFor (brandName, productUrl, shadeName) {
  if (!rules[brandName] || !productUrl) return undefined
  try {
    return rules[brandName](productUrl, shadeName)
  } catch (e) {
    return undefined
  }
}

module.exports = { shadeUrlFor }
