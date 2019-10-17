require('dotenv').config()
const fs = require('fs')
const { Client } = require('ldapts')

async function ldapSearch ({
  base = 'OU=UG,DC=ug,DC=kth,DC=se',
  filter = '',
  attributes = [],
  scope = 'sub'
}, extraOptions = {}) {
  let ldapClient
  try {
    ldapClient = new Client({
      url: process.env.UG_URL
    })
    await ldapClient.bind(process.env.UG_USERNAME, process.env.UG_PASSWORD)

    const options = {
      scope,
      filter,
      attributes,
      ...extraOptions
    }

    const { searchEntries } = await ldapClient.search(base, options)
    return searchEntries
  } catch (err) {
    err.message = 'Error in LPDAP: ' + err.message
    throw err
  } finally {
    await ldapClient.unbind()
  }
}

async function start () {
  const affiliates = await ldapSearch({
    filter: '(&(objectClass=user)(ugAffiliation=*affiliate*))',
    attributes: ['ugKthid', 'ugLadok3StudentUid', 'ugUsername', 'sn', 'givenName', 'mail']
  }, {
    sizeLimit: 1000
  })

  console.log(affiliates[0])

  const fileName = '/tmp/ug-affiliates.csv'
  fs.writeFileSync(fileName, [
    'user_id',
    'integration_id',
    'login_id',
    'first_name',
    'last_name',
    'sortable_name',
    'email',
    'status'
  ].join(',') + '\n')

  for (let user of affiliates) {
    fs.appendFileSync(fileName, [
      user.ugKthid,
      user.ugLadok3StudentUid,
      `${user.ugUsername}@kth.se`,
      user.givenName,
      user.sn,
      `"${user.sn}, ${user.givenName}"`,
      user.mail,
      'active'
    ].join(',') + '\n')
  }
}

start()
