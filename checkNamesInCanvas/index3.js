const fs = require('fs')
const papa = require('papaparse')
const CanvasApi = require('kth-canvas-api')

;(async function start () {
  const report = papa.parse(
    fs.readFileSync('/tmp/wrongs.csv', 'utf8'),
    {header: true}
  ).data

  const canvasApi = new CanvasApi(
    await getEnv('CANVAS_API_URL'),
    await getEnv('CANVAS_API_KEY')
  )

  for (let user of report) {
    if (true || user.correct_name === 'false' && user.correct_sortable_name === 'false' && user.correct_short_name === 'false') {
      const params = {
        user: {
          name: `${user.ug_given_name} ${user.ug_family_name}`,
          sortable_name: `${user.ug_family_name}, ${user.ug_given_name}`,
          short_name: null
        }
      }

      await canvasApi.updateUser(params, user.id)
    }
  }

  //fs.writeFileSync('/tmp/wrongs.csv', papa.unparse(wrongs))
})()
