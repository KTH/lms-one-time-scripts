const fs = require('fs')
const papa = require('papaparse')

;(async function start () {
  const report = papa.parse(
    fs.readFileSync('/tmp/report.csv', 'utf8'),
    { header: true }
  ).data

  const wrongs = report
    .filter(u => u.correct_name === 'false' || u.correct_sortable_name === 'false' || u.correct_short_name === 'false')

  fs.writeFileSync('/tmp/wrongs.csv', papa.unparse(wrongs))
})()
