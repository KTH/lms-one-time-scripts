const { getEnv } = require('../lib/envs')
const ldap = require('ldapjs')
const fs = require('fs')
const papa = require('papaparse')
const ora = require('ora')
const { promisify } = require('util')
const CanvasApi = require('kth-canvas-api')

async function ugSearch (kthId) {
  const searchOptions = {
    scope: 'sub',
    filter: `(ugKthId=${kthId})`,
    timeLimit: 10,
    paging: true,
    attributes: ['givenName', 'sn'],
    paged: {
      pageSize: 1000,
      pagePause: false
    }
  }
  const client = ldap.createClient({
    url: await getEnv('LDAP_URL')
  })

  const ldapBind = promisify(client.bind.bind(client))
  const ldapSearch = promisify(client.search.bind(client))
  const ldapUnbind = promisify(client.unbind.bind(client))

  await ldapBind(await getEnv('LDAP_USERNAME'), await getEnv('LDAP_PASSWORD'))
  const response = await ldapSearch('OU=UG,DC=ug,DC=kth,DC=se', searchOptions)

  const users = await new Promise((resolve, reject) => {
    const result = []

    response.on('searchEntry', entry => {
      result.push(entry.object)
    })

    response.on('error', err => {
      reject(err)
    })

    response.on('end', () => {
      resolve(result)
    })
  })

  await ldapUnbind()
  return users
}


;(async function start () {
  const canvasApi = new CanvasApi(await getEnv('CANVAS_API_URL'), await getEnv('CANVAS_API_KEY'))
  const report = []

  try {
    await canvasApi.get('/accounts/1/users?per_page=100', async (users) => {
      for (let user of users) {
        if (user.sis_user_id) {
          const [ ugUser ] = await ugSearch(user.sis_user_id)
          if (ugUser) {
            user.ug_given_name = ugUser.givenName
            user.ug_family_name = ugUser.sn

            user.correct_name          = user.name          === ugUser.givenName + ' ' + ugUser.sn
            user.correct_sortable_name = user.sortable_name === ugUser.sn + ', ' + ugUser.givenName
            user.correct_short_name    = user.short_name    === ugUser.givenName + ' ' + ugUser.sn
          } else {
            user.correct_name = 'Not IN UG'
          }
        } else {
          user.correct_name = 'Not IN UG'
        }

        report.push(user)
      }
    })
  } catch (e) {
    console.log(e)
  }

  fs.writeFileSync('/tmp/report.csv', papa.unparse(report))
})()
