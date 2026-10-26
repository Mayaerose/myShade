const mongoose = require('mongoose')

const webLink = {
  type: String,
  trim: true,
  set: v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  validate: { validator: v => !v || /^https?:\/\//i.test(v), message: 'Links must start with http:// or https://' }
}

// one proposed match between a shade and one of the 10 swatches. This is the APP's estimate, kept separate
// from the brand's own words, with how sure we are and why.
const toneMatchSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: [true, 'Choose a swatch for each match.'],
    min: [1, 'Swatch must be from 1 to 10.'],
    max: [10, 'Swatch must be from 1 to 10.'],
    validate: { validator: Number.isInteger, message: 'Swatch must be a whole number.' }
  },
  confidence: { type: String, enum: { values: ['high', 'medium', 'low'], message: 'Confidence must be high, medium, or low.' }, required: [true, 'Choose a confidence for each match.'] },
  basis: { type: String, required: [true, 'Add a short basis (why this range) for each match.'], trim: true }
}, { _id: false })

// one document = one named shade in one product line
const foundationSchema = new mongoose.Schema({
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: [true, 'Please choose a brand.'] },
  productLine: { type: String, required: [true, 'Product line is required.'], trim: true },
  productType: { type: String, enum: { values: ['liquid foundation', 'powder foundation', 'complexion tint', undefined], message: 'Choose a product type from the list.' } },
  shadeName: { type: String, required: [true, 'Shade name is required.'], trim: true }, // exactly as the brand writes it
  brandDepthLabel: { type: String, trim: true },  // the brand's own depth words, never rewritten
  brandUndertone: { type: String, trim: true },   // the brand's own undertone words/code, never rewritten
  toneMatches: {
    type: [toneMatchSchema],
    validate: { validator: v => v.length >= 1, message: 'Add at least one swatch match.' }
  },
  productUrl: webLink,
  shadeUrl: webLink, // a link that opens this exact shade, when the brand's site supports it
  shadeSourceUrl: webLink,
  imageUrl: webLink, // optional: only add an image when you are allowed to use it
  sourceCoverage: { type: String, trim: true },   // is the shade list complete or partial?
  availabilityNote: { type: String, trim: true },
  reviewStatus: { type: String, enum: ['needs-review', 'approved', 'inactive'], default: 'needs-review' },
  checkedAt: Date // the day the source was checked
}, { timestamps: true })

// the same brand + product line + shade can only be saved once
foundationSchema.index({ brand: 1, productLine: 1, shadeName: 1 }, { unique: true })
foundationSchema.index({ 'toneMatches.level': 1, reviewStatus: 1 })

module.exports = mongoose.model('Foundation', foundationSchema)
