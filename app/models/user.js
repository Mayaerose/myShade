const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }, // the HASH, never the real password
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  preferredToneLevel: { type: Number, min: 1, max: 10, validate: { validator: Number.isInteger, message: 'Swatch must be a whole number.' } }
}, { timestamps: true })

userSchema.methods.generateHash = function (password) {
  return bcrypt.hashSync(password, 8)
}

userSchema.methods.validPassword = function (password) {
  return bcrypt.compareSync(password, this.password)
}

module.exports = mongoose.model('User', userSchema)
