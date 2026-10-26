// Run once from the terminal to make YOUR account an admin:
//   node scripts/makeAdmin.js you@example.com
// There is no website route for this, so nobody can promote themselves.
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../app/models/user')

async function run () {
  const email = (process.argv[2] || '').toLowerCase().trim()
  if (!email) return console.log('Usage: node scripts/makeAdmin.js you@example.com')
  await mongoose.connect(process.env.MONGODB_URI)
  const user = await User.findOneAndUpdate({ email }, { role: 'admin' })
  console.log(user ? email + ' is now an admin' : 'No account found for ' + email + '. Sign up on the website first.')
  await mongoose.disconnect()
}
run()
