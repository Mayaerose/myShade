// Loads the 40-brand roster and the proposed shade recommendations into MongoDB.
//   npm run import:dry   -> only shows what WOULD be saved (no database needed)
//   npm run import       -> saves it
//
// Every shade is saved as "needs-review". Nothing shows up for the public until YOU
// approve it in the admin pages. It is safe to run twice: it never overwrites your edits.
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')
const tones = require('../config/tones')
const { shadeUrlFor } = require('../lib/shadeLinks')

const read = file => parse(fs.readFileSync(path.join(__dirname, '../data', file)), { columns: true, bom: true, skip_empty_lines: true })
const roster = read('shade-matcher-40-brand-roster.csv')
const recs = read('shade-matcher-10-tone-recommendations.csv')

const websiteOf = url => { try { return new URL(url).origin } catch (e) { return undefined } }
const blank = v => (v && v.trim() ? v.trim() : undefined)

// group the recommendation rows by shade (a shade can have several tone matches)
const shades = new Map()
for (const r of recs) {
  const key = [r.brand_name, r.product_line, r.shade_name].join('|')
  if (!shades.has(key)) {
    shades.set(key, {
      brandName: r.brand_name,
      productLine: r.product_line.trim(),
      shadeName: r.shade_name.trim(),
      brandDepthLabel: blank(r.brand_depth_label),
      brandUndertone: blank(r.brand_undertone),
      toneMatches: [],
      productUrl: blank(r.official_product_url),
      shadeUrl: shadeUrlFor(r.brand_name, blank(r.official_product_url), r.shade_name.trim()),
      shadeSourceUrl: blank(r.official_shade_source_url),
      sourceCoverage: blank(r.source_coverage),
      availabilityNote: blank(r.availability_note),
      reviewStatus: 'needs-review', // always. Approving is your job.
      checkedAt: r.checked_date ? new Date(r.checked_date) : undefined
    })
  }
  shades.get(key).toneMatches.push({
    level: Number(r.app_tone_level_proposed),
    confidence: r.mapping_confidence.trim().toLowerCase(),
    basis: r.mapping_basis.trim()
  })
}

function report () {
  console.log(roster.length + ' brands in the roster, ' + shades.size + ' proposed shades (' + recs.length + ' recommendation rows)')
  const rosterNames = new Set(roster.map(b => b.brand_name))
  const unknown = [...new Set([...shades.values()].map(s => s.brandName))].filter(n => !rosterNames.has(n))
  if (unknown.length) console.log('WARNING: not in the roster: ' + unknown.join(', '))
  const withLink = [...shades.values()].filter(s => s.shadeUrl)
  console.log('\nShade-specific links built for ' + withLink.length + ' of ' + shades.size + ' shades. Examples:')
  ;['Fenty Beauty', 'M·A·C Cosmetics', 'Bobbi Brown'].forEach(b => { const s = withLink.find(x => x.brandName === b); if (s) console.log(' ' + s.shadeName + ' -> ' + s.shadeUrl) })
  const perTone = {}
  tones.forEach(t => {
    const brands = new Set()
    shades.forEach(s => { if (s.toneMatches.some(m => m.level === t.level)) brands.add(s.brandName) })
    perTone[t.name] = brands.size
  })
  console.log('\nDistinct brands per swatch (proposed, none approved yet):'); console.table(perTone)
}

async function run () {
  report()
  if (process.argv.includes('--dry-run')) return console.log('Dry run only. Nothing was saved.')
  const mongoose = require('mongoose')
  const Brand = require('../app/models/brand')
  const Foundation = require('../app/models/foundation')
  await mongoose.connect(process.env.MONGODB_URI)

  const ids = {}
  for (const b of roster) {
    // $setOnInsert = only fill these in the first time, never overwrite later edits
    const fields = { name: b.brand_name.trim(), slug: Brand.slugify(b.brand_name), websiteUrl: websiteOf(b.official_product_url), isActive: true }
    const doc = await Brand.findOneAndUpdate({ name: fields.name }, { $setOnInsert: fields }, { upsert: true, returnDocument: 'after' })
    ids[fields.name] = doc._id
  }

  let added = 0
  for (const s of shades.values()) {
    const { brandName, ...fields } = s
    const result = await Foundation.updateOne(
      { brand: ids[brandName], productLine: s.productLine, shadeName: s.shadeName },
      { $setOnInsert: { ...fields, brand: ids[brandName] } },
      { upsert: true }
    )
    if (result.upsertedCount) added++
    // shades saved earlier get their shade link added too (only if they don't have one yet)
    if (s.shadeUrl) await Foundation.updateOne({ brand: ids[brandName], productLine: s.productLine, shadeName: s.shadeName, shadeUrl: { $exists: false } }, { $set: { shadeUrl: s.shadeUrl } })
  }
  console.log('Saved. ' + roster.length + ' brands checked, ' + added + ' new shades added as needs-review (' + (shades.size - added) + ' already existed).')
  await mongoose.disconnect()
}
run().catch(err => { console.log('Import failed:', err.message); process.exit(1) })
