const mongoose = require('mongoose')

// "L’Oréal Paris" -> "l-oreal-paris"
function slugify (text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const brandSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Brand name is required.'], trim: true, unique: true },
  slug: { type: String, unique: true, trim: true, lowercase: true },
  websiteUrl: {
    type: String,
    trim: true,
    set: v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    // only web links, so a "javascript:" link can never end up on the page
    validate: { validator: v => !v || /^https?:\/\//i.test(v), message: 'Website must start with http:// or https://' }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

// fill in the slug from the name when it is empty
brandSchema.pre('validate', function () {
  if (!this.slug && this.name) this.slug = slugify(this.name)
})

brandSchema.statics.slugify = slugify

module.exports = mongoose.model('Brand', brandSchema)
