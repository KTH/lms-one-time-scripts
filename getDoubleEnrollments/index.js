require('dotenv').config()
const CanvasApi = require('kth-canvas-api')
const inquirer = require('inquirer')
const chalk = require('chalk')
const ora = require('ora')
const silentLogger = require('bunyan').createLogger({
  name: 'xxx',
  level: 100
})
const rp = require('request-promise')
const papa = require('papaparse')
const fs = require('fs')

if (!process.env.CANVAS_API_URL) {
  console.error('The env variable CANVAS_API_URL is not set.')
  process.exit()
}
if (!process.env.CANVAS_API_TOKEN) {
  console.error('The env variable CANVAS_API_TOKEN is not set.')
}

const canvas = new CanvasApi(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
canvas.logger = silentLogger

/**
 * Get the last Enrollments report. Ask (to the user if that one is ok)
 */
async function getReport () {
  const reports = (await canvas.requestUrl(`/accounts/1/reports/provisioning_csv`))
    .filter(r => r.parameters.enrollments)
    .filter(r => !r.parameters.created_by_sis || r.parameters.created_by_sis !== '1')

  if (reports.length === 0) {
    console.log('No valid reports found...')
    return
  }

  const lastReport = reports[0]
  const days = Math.round((new Date() - new Date(lastReport.created_at)) / (1000 * 3600 * 24))

  console.log()
  console.log([
    `There is a provisioning report found.`,
    chalk`It was created on ${lastReport.created_at} {bold (${days} days ago)}`
  ].join('\n'))

  const { valid } = await inquirer.prompt([{
    name: 'valid',
    type: 'confirm',
    message: `Do you want to use it?`
  }])

  return valid && waitUntilComplete(lastReport)
}

async function newReport () {
  const report = await canvas.requestUrl('accounts/1/reports/provisioning_csv', 'POST', {
    parameters: {
      enrollments: true
    }
  })

  console.log(`Report created! Waiting until it's complete`)

  return waitUntilComplete(report)
}

async function waitUntilComplete (report) {
  const sleep = t => new Promise(accept => setTimeout(accept, t))
  const spinner = ora('Waiting until the report is completed').start()

  while (report.status !== 'complete') {
    await sleep(1000)
    report = await canvas.requestUrl(`accounts/1/reports/provisioning_csv/${report.id}`)
    spinner.text = `Wating until report is completed... file is now ${report.current_line} lines long`
  }

  spinner.succeed('Report completed')

  return report
}

function getLocalReport (report) {
  const fileName = `/tmp/${report.id}.csv`

  try {
    const csv = fs.readFileSync(fileName, 'utf8')
    return csv
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`File ${fileName} not available`)
    } else {
      throw err
    }
  }
}

const saveContentToFile = fileName => content => new Promise(accept => {
  const writeStream = fs.writeFileSync(fileName, content)

  return content
})

async function downloadReport (report) {
  const url = report.attachment.url
  const fileName = `/tmp/${report.id}.csv`

  const spinner = ora(`Downloading CSV file from ${url} to ${fileName}`).start()

  const content = await rp({url, headers: {'Connection': 'keep-alive'}})
    .then(saveContentToFile(fileName))

  spinner.succeed()
  return content
}

async function start () {
  const report = await getReport() || await newReport()
  const csv = await getLocalReport(report) || await downloadReport(report)

  const enrollments = papa.parse(csv, {header: true}).data
  const groupedEnrollments = new Map()
  const spinner = ora('Grouping by section_id and user_id').start()
  const duplicated = []

  for (let e of enrollments) {
    const key = e.canvas_section_id + ':' + e.canvas_user_id
    if (!groupedEnrollments.has(key)) {
      groupedEnrollments.set(key, [])
    }

    groupedEnrollments.get(key).push(e)
  }

  for (let [key, value] of groupedEnrollments) {
    if (value.length > 1) {
      duplicated.push({
        canvas_user_id: value[0].canvas_user_id,
        user_id: value[0].user_id,
        canvas_section_id: value[0].canvas_section_id,
        section_id: value[0].section_id,
        roles: value.map(v => v.role),
        role_ids: value.map(v => v.role_id),
        enrollments: value.map(v => v.canvas_enrollment_id)
      })
      groupedEnrollments.delete(key)
    }
  }
  spinner.succeed()

  console.log(`Users-in-sections with more than 1 role: ${duplicated.length}`)

  const filtered = duplicated
    .filter(d => d.section_id)
    .filter(d => d.role_ids.includes('3') && d.role_ids.includes('11') )

  console.log(`Users-in-sections that are Re-reg(id 11) and Student(id 3): ${filtered.length}`)

  fs.writeFileSync('./results.csv', [
    'canvas_user_id',
    'user_id',
    'canvas_section_id',
    'section_id',
    // 'roles',
    // 'role_ids',
    'enrollments'
  ].join(',') + '\n')

  for (let d of filtered) {
    fs.appendFileSync(
      './results.csv',
      [
        d.canvas_user_id,
        d.user_id,
        d.canvas_section_id,
        d.section_id,
        //d.roles.join(' + '),
        //d.role_ids.join(' + '),
        d.enrollments.join(' + ')
      ].join(',') + '\n',
      'utf8'
    )
  }

}

start()
