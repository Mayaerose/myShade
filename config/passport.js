const LocalStrategy = require('passport-local').Strategy
const User = require('../app/models/user')

module.exports = function (passport) {
  passport.serializeUser((user, done) => done(null, user.id))

  passport.deserializeUser(async (id, done) => {
    try {
      done(null, await User.findById(id))
    } catch (err) {
      done(err)
    }
  })

  // SIGNUP
  passport.use('local-signup', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  }, async (req, email, password, done) => {
    try {
      if (password.length < 6) {
        return done(null, false, req.flash('problem', 'Password must be at least 6 characters.'))
      }
      if (await User.findOne({ email: email.toLowerCase().trim() })) {
        return done(null, false, req.flash('problem', 'That email is already taken.'))
      }
      const newUser = new User()
      newUser.email = email
      newUser.password = newUser.generateHash(password)
      // role is never read from the form: everyone who signs up is a regular "user"
      await newUser.save()
      return done(null, newUser)
    } catch (err) {
      return done(err)
    }
  }))

  // LOGIN
  passport.use('local-login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  }, async (req, email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase().trim() })
      if (!user || !user.validPassword(password)) {
        return done(null, false, req.flash('problem', 'Email or password is not right.'))
      }
      return done(null, user)
    } catch (err) {
      return done(err)
    }
  }))
}
