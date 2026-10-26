// The 10 skin tone swatches, in order (the colors come from the Monk palette). The number is what gets saved in MongoDB (a "level").
// They are named "Shade 01" to "Shade 10".
const swatches = [
  { level: 1,  hex: '#f6ede4' },
  { level: 2,  hex: '#f3e7db' },
  { level: 3,  hex: '#f7ead0' },
  { level: 4,  hex: '#eadaba' },
  { level: 5,  hex: '#d7bd96' },
  { level: 6,  hex: '#a07e56' },
  { level: 7,  hex: '#825c43' },
  { level: 8,  hex: '#604134' },
  { level: 9,  hex: '#3a312a' },
  { level: 10, hex: '#292420' }
]

module.exports = swatches.map(s => ({
  ...s,
  name: 'Shade ' + String(s.level).padStart(2, '0'),
  number: String(s.level).padStart(2, '0')
}))
