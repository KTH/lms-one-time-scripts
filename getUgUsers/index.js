const { getEnv } = require('../lib/envs')
const ldap = require('ldapjs')
const ora = require('ora')
const fs = require('fs')
const fixedHeaders = ['kthid', 'username', 'name']

async function getUsers () {
  const result = []
  const client = ldap.createClient({
    url: await getEnv('LDAP_URL')
  })
  const options = {
    filter: 'objectClass=user',
    scope: 'sub',
    paged: true,
    sizeLimit: 1000,
    attributes: ['ugKthid', 'ugUsername', 'sn', 'givenName']
  }


  return new Promise(async (resolve, reject) => {
    const bindingSpinner = ora('Connecting to LDAP').start()

    function unbind () {
      const unbindSpinner = ora('Disconnecting LDAP...')
      client.unbind((err) => {
        if (err) {
          unbindSpinner.fail()
          console.error('Error trying to disconnect the LDAP client. The process will be terminated abruptly')
          process.exit()
        }
        unbindSpinner.succeed('LDAP disconected')
      })
    }

    client.bind(await getEnv('LDAP_USERNAME'), await getEnv('LDAP_PASSWORD'), (err) => {
      if (err) {
        bindingSpinner.fail('Error connecting to UG via LDAP')
        reject(err)
        return unbind()
      }
      bindingSpinner.succeed('LDAP connected')

      const searchSpinner = ora('Searching users...').start()
      client.search('OU=UG,DC=ug,DC=kth,DC=se', options, (err, response) => {
        if (err) {
          console.error('Error on search')
          reject(err)
          return unbind()
        }

        response.on('searchEntry', (entry) => {
          searchSpinner.text = `Searching users... ${result.length} found`
          result.push(entry.object)
        })

        response.on('error', (err) => {
          searchSpinner.fail()
          console.error('An error event was emitted from the LDAP client')
          reject(err)
          return unbind()
        })

        response.on('end', () => {
          searchSpinner.succeed()
          resolve(result)
          return unbind()
        })
      })
    })
  })
}

async function writeCsv (users) {

}



;(async function start () {
  try {
    const fileName = '/tmp/ug-users.csv'
    const users = await getUsers()
    const spinner = ora('Writing CSV file...').start()
    fs.writeFileSync(fileName, ['kthid', 'username', 'given_name', 'family_name'].join(',') + '\n')

    for (let user of users) {
      fs.appendFileSync(fileName, [user.ugKthid, user.ugUsername, user.givenName, user.sn].join(',') + '\n')
    }
    spinner.succeed()
  } catch (err) {
    console.error(err)
  }
})()
