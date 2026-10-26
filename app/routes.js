const Brand = require('./models/brand')
const Foundation = require('./models/foundation')
const tones = require('../config/tones')

const PAGE_SIZE = 40
const STATUSES = ['needs-review', 'approved', 'inactive']
const PRODUCT_TYPES = ['liquid foundation', 'powder foundation', 'complexion tint']
const CONFIDENCES = ['high', 'medium', 'low']
const MATCH_SLOTS = 3

module.exports = function (app, passport) {

// account pages ===============================================================

  app.get('/login', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/')
    res.render('login.ejs', { title: 'Log in' })
  })
  app.post('/login', passport.authenticate('local-login', { successRedirect: '/', failureRedirect: '/login', failureFlash: true }))

  app.get('/signup', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/')
    res.render('signup.ejs', { title: 'Sign up' })
  })
  app.post('/signup', passport.authenticate('local-signup', { successRedirect: '/', failureRedirect: '/signup', failureFlash: true }))

  app.post('/logout', (req, res, next) => {
    req.logout(err => {
      if (err) return next(err)
      res.redirect('/')
    })
  })

// public finder (no account needed) ===========================================

  // the 10 swatches
  app.get('/', (req, res) => {
    res.render('home.ejs', { title: 'Find your shade', wide: true, tones, selected: req.user && req.user.preferredToneLevel })
  })

  // matches. POST is the form on the home page; GET lets a result be linked to and refreshed
  app.post('/matches', (req, res) => showMatches(req, res, req.body.toneLevel, req.body.includeReview))
  app.get('/matches', (req, res) => showMatches(req, res, req.query.toneLevel, req.query.includeReview))

  async function showMatches (req, res, rawLevel, rawIncludeReview) {
    const level = parseLevel(rawLevel)
    if (!level) {
      req.flash('problem', 'Please choose one of the 10 swatches.')
      return res.redirect('/')
    }
    // only an admin can look at shades that have not been approved yet (to review them)
    const preview = Boolean(rawIncludeReview) && req.isAuthenticated() && req.user.role === 'admin'

    const activeBrandIds = await Brand.find({ isActive: true }).distinct('_id')
    const filter = { 'toneMatches.level': level, brand: { $in: activeBrandIds } }
    filter.reviewStatus = preview ? { $in: ['approved', 'needs-review'] } : 'approved'
    const foundations = await Foundation.find(filter).populate('brand')

    // group the shades under each brand, so every brand counts once
    const groups = new Map()
    for (const f of foundations) {
      const key = String(f.brand._id)
      if (!groups.has(key)) groups.set(key, { brand: f.brand, shades: [] })
      groups.get(key).shades.push(f)
    }
    const brands = [...groups.values()].sort((a, b) => a.brand.name.localeCompare(b.brand.name))
    brands.forEach(g => g.shades.sort((a, b) => a.shadeName.localeCompare(b.shadeName, undefined, { numeric: true })))

    res.render('matches.ejs', {
      title: tones[level - 1].name,
      tone: tones[level - 1],
      neighbors: [tones[level - 2], tones[level]].filter(Boolean),
      brands,
      brandCount: brands.length,
      shadeCount: foundations.length,
      preview,
      level,
      isSaved: req.isAuthenticated() && req.user.preferredToneLevel === level
    })
  }

  // one brand's active catalog entries and source links
  app.get('/brands/:slug', async (req, res) => {
    const brand = await Brand.findOne({ slug: req.params.slug, isActive: true })
    if (!brand) return notFound(res)
    const isAdminUser = req.isAuthenticated() && req.user.role === 'admin'
    const filter = { brand: brand._id, reviewStatus: isAdminUser ? { $ne: 'inactive' } : 'approved' }
    const foundations = await Foundation.find(filter).sort({ productLine: 1, shadeName: 1 })
    res.render('brand.ejs', { title: brand.name, brand, foundations, tones })
  })

  // remember a signed-in user's swatch
  app.post('/profile/tone', isLoggedIn, async (req, res) => {
    const level = parseLevel(req.body.toneLevel)
    if (!level) {
      req.flash('problem', 'Please choose one of the 10 swatches.')
      return res.redirect('/')
    }
    req.user.preferredToneLevel = level
    await req.user.save()
    req.flash('info', 'Saved ' + tones[level - 1].name + ' as your swatch.')
    res.redirect('/')
  })

// admin dashboard =============================================================

  app.get('/admin', isAdmin, async (req, res) => {
    const statusRows = await Foundation.aggregate([{ $group: { _id: '$reviewStatus', n: { $sum: 1 } } }])
    const statusCounts = { 'needs-review': 0, approved: 0, inactive: 0 }
    statusRows.forEach(r => { statusCounts[r._id] = r.n })

    // distinct brands per range, counted by brand id (not by shade rows)
    const rangeRows = await Foundation.aggregate([
      { $unwind: '$toneMatches' },
      { $group: { _id: { level: '$toneMatches.level', status: '$reviewStatus', brand: '$brand' } } },
      { $group: { _id: { level: '$_id.level', status: '$_id.status' }, brands: { $sum: 1 } } }
    ])
    const perRange = tones.map(t => ({ tone: t, approved: 0, needsReview: 0 }))
    rangeRows.forEach(r => {
      const row = perRange[r._id.level - 1]
      if (!row) return
      if (r._id.status === 'approved') row.approved = r.brands
      if (r._id.status === 'needs-review') row.needsReview = r.brands
    })
    res.render('admin/index.ejs', {
      title: 'Admin', statusCounts, perRange,
      brandCount: await Brand.countDocuments(), activeBrandCount: await Brand.countDocuments({ isActive: true })
    })
  })

// admin: brands ===============================================================

  app.get('/admin/brands', isAdmin, async (req, res) => {
    const brands = await Brand.find().sort({ name: 1 })
    const counts = await Foundation.aggregate([{ $group: { _id: '$brand', n: { $sum: 1 } } }])
    const countOf = {}
    counts.forEach(c => { countOf[String(c._id)] = c.n })
    res.render('admin/brands.ejs', { title: 'Brands', brands, countOf })
  })

  app.get('/admin/brands/new', isAdmin, (req, res) => {
    res.render('admin/brand-form.ejs', { title: 'Add a brand', heading: 'Add a brand', action: '/admin/brands', brand: { isActive: true }, problem: null })
  })

  app.post('/admin/brands', isAdmin, async (req, res) => {
    try {
      await Brand.create(brandFields(req.body))
      req.flash('info', 'Brand added.')
      res.redirect('/admin/brands')
    } catch (err) {
      res.status(400).render('admin/brand-form.ejs', { title: 'Add a brand', heading: 'Add a brand', action: '/admin/brands', brand: req.body, problem: friendly(err) })
    }
  })

  app.get('/admin/brands/:id/edit', isAdmin, async (req, res) => {
    const brand = await findById(Brand, req.params.id)
    if (!brand) return notFound(res)
    res.render('admin/brand-form.ejs', { title: 'Edit brand', heading: 'Edit brand', action: '/admin/brands/' + brand._id, brand, problem: null })
  })

  app.post('/admin/brands/:id', isAdmin, async (req, res) => {
    const brand = await findById(Brand, req.params.id)
    if (!brand) return notFound(res)
    try {
      brand.set(brandFields(req.body))
      await brand.save()
      req.flash('info', 'Brand updated.')
      res.redirect('/admin/brands')
    } catch (err) {
      res.status(400).render('admin/brand-form.ejs', {
        title: 'Edit brand', heading: 'Edit brand', action: '/admin/brands/' + brand._id,
        brand: { ...req.body, _id: brand._id }, problem: friendly(err)
      })
    }
  })

  // a brand that still has shades is hidden (deactivated) instead of deleted
  app.post('/admin/brands/:id/delete', isAdmin, async (req, res) => {
    const brand = await findById(Brand, req.params.id)
    if (!brand) return notFound(res)
    if (await Foundation.exists({ brand: brand._id })) {
      brand.isActive = false
      await brand.save()
      req.flash('info', brand.name + ' still has shade records, so it was deactivated (hidden) instead of deleted.')
    } else {
      await brand.deleteOne()
      req.flash('info', 'Brand removed.')
    }
    res.redirect('/admin/brands')
  })

// admin: foundations ==========================================================

  // READ: search / filter by brand, range, and review status
  app.get('/admin/foundations', isAdmin, async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const filter = {}
    if (isId(req.query.brand)) filter.brand = req.query.brand
    if (parseLevel(req.query.level)) filter['toneMatches.level'] = parseLevel(req.query.level)
    if (STATUSES.includes(req.query.status)) filter.reviewStatus = req.query.status
    const total = await Foundation.countDocuments(filter)
    const foundations = await Foundation.find(filter).populate('brand')
      .sort({ brand: 1, shadeName: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
    const query = new URLSearchParams()
    if (filter.brand) query.set('brand', filter.brand)
    if (req.query.level && parseLevel(req.query.level)) query.set('level', req.query.level)
    if (filter.reviewStatus) query.set('status', filter.reviewStatus)
    res.render('admin/foundations.ejs', {
      title: 'Foundations', foundations, brands: await Brand.find().sort({ name: 1 }), tones, STATUSES, total, page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), filters: { brand: filter.brand || '', level: req.query.level || '', status: filter.reviewStatus || '' },
      queryString: query.toString()
    })
  })

  // CREATE form
  app.get('/admin/foundations/new', isAdmin, async (req, res) => {
    res.render('admin/foundation-form.ejs', await formData({ heading: 'Add a shade', action: '/admin/foundations', foundation: { reviewStatus: 'needs-review' } }))
  })

  // CREATE
  app.post('/admin/foundations', isAdmin, async (req, res) => {
    try {
      await Foundation.create(foundationFields(req.body))
      req.flash('info', 'Shade added.')
      res.redirect('/admin/foundations')
    } catch (err) {
      res.status(400).render('admin/foundation-form.ejs', await formData({
        heading: 'Add a shade', action: '/admin/foundations', foundation: req.body, slots: slotsFromBody(req.body), problem: friendly(err)
      }))
    }
  })

  // UPDATE form
  app.get('/admin/foundations/:id/edit', isAdmin, async (req, res) => {
    const foundation = await findById(Foundation, req.params.id)
    if (!foundation) return notFound(res)
    res.render('admin/foundation-form.ejs', await formData({
      heading: 'Edit shade', action: '/admin/foundations/' + foundation._id, foundation, slots: foundation.toneMatches.map(m => ({ level: m.level, confidence: m.confidence, basis: m.basis }))
    }))
  })

  // UPDATE
  app.post('/admin/foundations/:id', isAdmin, async (req, res) => {
    const foundation = await findById(Foundation, req.params.id)
    if (!foundation) return notFound(res)
    try {
      foundation.set(foundationFields(req.body))
      await foundation.save()
      req.flash('info', 'Shade updated.')
      res.redirect('/admin/foundations')
    } catch (err) {
      res.status(400).render('admin/foundation-form.ejs', await formData({
        heading: 'Edit shade', action: '/admin/foundations/' + foundation._id,
        foundation: { ...req.body, _id: foundation._id }, slots: slotsFromBody(req.body), problem: friendly(err)
      }))
    }
  })

  // quick review buttons (approve / needs review / inactive) from the list
  app.post('/admin/foundations/:id/status', isAdmin, async (req, res) => {
    const foundation = await findById(Foundation, req.params.id)
    if (!foundation) return notFound(res)
    if (!STATUSES.includes(req.body.status)) {
      req.flash('problem', 'Unknown review status.')
    } else {
      foundation.reviewStatus = req.body.status
      await foundation.save()
      req.flash('info', foundation.shadeName + ' is now ' + req.body.status + '.')
    }
    res.redirect(safeBack(req.body.back))
  })

  // DELETE
  app.post('/admin/foundations/:id/delete', isAdmin, async (req, res) => {
    const foundation = await findById(Foundation, req.params.id)
    if (!foundation) return notFound(res)
    await foundation.deleteOne()
    req.flash('info', 'Shade removed.')
    res.redirect('/admin/foundations')
  })
}

// helpers =====================================================================

// route middleware: must be signed in
function isLoggedIn (req, res, next) {
  if (req.isAuthenticated()) return next()
  req.flash('problem', 'Please log in first.')
  res.redirect('/login')
}

// route middleware: signed in AND an admin (checked on the server every time)
function isAdmin (req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/login')
  if (req.user.role !== 'admin') {
    return res.status(403).render('error.ejs', { title: 'Not allowed', text: 'Only admins can open this page.' })
  }
  next()
}

// "4" -> 4. Anything that is not a whole number from 1 to 10 -> null
function parseLevel (value) {
  if (!/^([1-9]|10)$/.test(String(value))) return null
  return Number(value)
}

const isId = id => /^[a-f\d]{24}$/i.test(String(id))
const findById = (Model, id) => (isId(id) ? Model.findById(id) : null)

// only go back to our own admin pages
function safeBack (back) {
  return typeof back === 'string' && back.startsWith('/admin/') ? back : '/admin/foundations'
}

function brandFields (body) {
  return { name: body.name, slug: body.slug || undefined, websiteUrl: body.websiteUrl, isActive: body.isActive === 'on' }
}

// the form sends repeated fields (matchLevel, matchConfidence, matchBasis). Turn them into a list.
function slotsFromBody (body) {
  const levels = [].concat(body.matchLevel || [])
  const confidences = [].concat(body.matchConfidence || [])
  const bases = [].concat(body.matchBasis || [])
  return levels.map((level, i) => ({ level, confidence: confidences[i] || '', basis: bases[i] || '' })).filter(s => s.level !== '')
}

function foundationFields (body) {
  return {
    brand: body.brand || undefined,
    productLine: body.productLine,
    productType: body.productType || undefined,
    shadeName: body.shadeName,
    brandDepthLabel: body.brandDepthLabel,
    brandUndertone: body.brandUndertone,
    toneMatches: slotsFromBody(body).map(s => ({ level: s.level, confidence: s.confidence || undefined, basis: s.basis })),
    productUrl: body.productUrl,
    shadeUrl: body.shadeUrl,
    shadeSourceUrl: body.shadeSourceUrl,
    imageUrl: body.imageUrl,
    sourceCoverage: body.sourceCoverage,
    availabilityNote: body.availabilityNote,
    reviewStatus: STATUSES.includes(body.reviewStatus) ? body.reviewStatus : 'needs-review',
    checkedAt: body.checkedAt || undefined
  }
}

async function formData (extra) {
  const slots = (extra.slots || []).slice(0, MATCH_SLOTS)
  while (slots.length < MATCH_SLOTS) slots.push({ level: '', confidence: 'medium', basis: '' })
  return {
    title: extra.heading, brands: await Brand.find().sort({ name: 1 }), tones, STATUSES, PRODUCT_TYPES, CONFIDENCES,
    problem: null, ...extra, slots
  }
}

function notFound (res) {
  res.status(404).render('error.ejs', { title: 'Not found', text: 'We could not find that.' })
}

function friendly (err) {
  if (err.code === 11000) return 'That entry already exists (same name or slug, or same brand + product line + shade).'
  if (err.name === 'ValidationError') return Object.values(err.errors).map(e => e.message).join(' ')
  if (err.name === 'CastError') return 'Please check the values you entered.'
  throw err
}
