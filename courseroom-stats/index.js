const { getEnv } = require('../lib/envs')
const papa = require('papaparse')
const Canvas = require('@kth/canvas-api')
const fs = require('fs')

// Uncomment the following block when starting
// When resuming, comment it or otherwise will delete the entire file!
  /*
fs.writeFileSync('/tmp/courses_table.csv', [
  'Course ID', 'SIS ID', 'Name', 'Students', 'Sections', 'Account'
].join(',') + '\n')
fs.writeFileSync('/tmp/sections_table.csv', [
  'Section ID', 'Section SIS ID', 'Section name', 'Students',
  'Course ID', 'Course SIS ID', 'XCourse SIS ID'
].join(',') + '\n')
*/

;(async function start () {
  const canvas = Canvas(await getEnv('CANVAS_API_URL'), await getEnv('CANVAS_API_KEY'))
  const sectionsTable = []
  const coursesTable = []

  try {
    for await (let course of canvas.list('/accounts/1/courses', { include: ['total_students', 'account'] })) {
      if (course.sis_course_id && course.sis_course_id.startsWith('RAPP')) {
        continue
      }

      // Uncomment the following line if you want to "resume"
      // if (course.id < 1438) continue

      console.log(`Course ${course.sis_course_id} - ${course.id}`)

      const sections = await canvas.list(`/courses/${course.id}/sections`, { include: ['total_students'] }).toArray()
      fs.appendFileSync('/tmp/courses_table.csv', [
        course.id,
        course.sis_course_id,
        '"' + course.name + '"',
        course.total_students,
        sections.length,
        course.account.name
      ].join(',') + '\n')

      for (let section of sections) {
        // Un comment the following line if you want to "resume"
        // if (section.id < 1503) continue
        fs.appendFileSync('/tmp/sections_table.csv', [
          section.id,
          section.section_sis_id,
          '"' + section.name + '"',
          section.total_students,

          course.id,
          course.sis_course_id,
          section.nonxlist_course_id
        ].join(',') + '\n')
      }
    }

    fs.writeFileSync('/tmp/sections_table.csv', papa.unparse(sectionsTable))
  } catch (e) {
    console.error(e)
    process.exit()
  }
})()
