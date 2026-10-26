// server.js
require('dotenv').config() // loads MONGODB_URI and SESSION_SECRET from the .env file
const express = require('express')
const app = express()
const port = process.env.PORT || 8080
const mongoose = require('mongoose')
const passport = require('passport')
const flash = require('connect-flash')
const session = require('express-session')
const { MongoStore } = require('connect-mongo')

if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET) {
  console.log('Missing MONGODB_URI or SESSION_SECRET. Fill in your .env file (see .env.example).')
  process.exit(1)
}

require('./config/passport')(passport)

app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: true })) // read html forms
app.use(express.static('public'))

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }), // logins survive a restart
  cookie: { sameSite: 'lax', httpOnly: true } // helps block forms submitted from other websites
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

// make these available in every EJS page
app.use((req, res, next) => {
  res.locals.user = req.user
  res.locals.info = req.flash('info')
  res.locals.problem = req.flash('problem')
  next()
})

require('./app/routes.js')(app, passport)

// any error from a route ends up here
app.use((err, req, res, next) => {
  console.log(err)
  res.status(500).render('error.ejs', { title: 'Something went wrong', text: 'Sorry, something went wrong on our end.' })
})

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')
    app.listen(port, () => console.log('myShade is running on http://localhost:' + port))
  })
  .catch(err => {
    console.log('Could not connect to MongoDB:', err.message)
    process.exit(1)
  })
