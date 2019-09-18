require('dotenv').config()
const CanvasApi = require('@kth/canvas-api')
const canvas = CanvasApi(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
const { Client } = require('ldapts')

async function ldapSearch ({
  base = 'OU=UG,DC=ug,DC=kth,DC=se',
  filter = '',
  attributes = [],
  scope = 'sub'
}) {
  let ldapClient
  try {
    ldapClient = new Client({
      url: process.env.UG_URL
    })
    await ldapClient.bind(process.env.UG_USERNAME, process.env.UG_PASSWORD)

    const options = {
      scope,
      filter,
      attributes
    }

    const { searchEntries } = await ldapClient.search(base, options)
    return searchEntries
  } catch (err) {
    err.message = 'Error in LDAP: ' + err.message
    throw err
  } finally {
    await ldapClient.unbind()
  }
}

async function setupUser (kthId, ladokId) {
  for await (const login of canvas.list(`/users/sis_user_id:${kthId}/logins`)) {
    if (login.sis_user_id === kthId) {
      const body = {
        login: {
          integration_id: ladokId
        }
      }

      await canvas.requestUrl(`/accounts/${login.account_id}/logins/${login.id}`, 'PUT', body)
    } else {
      console.log(`${login.sis_user_id} != ${kthId}`)
    }
  }
}

async function start () {
  let i = 0
  const breakAfter = 10
  for await (const user of canvas.list('/accounts/1/users')) {
    try {
      if (user.sis_user_id && !user.integration_id) {
        const kthId = user.sis_user_id
        const ugUser = await ldapSearch({ filter: `(ugKthId=${user.sis_user_id})`, attributes: ['ugLadok3StudentUid'] })
        const ladokId = ugUser[0].ugLadok3StudentUid

        if (ladokId) {
          await setupUser(kthId, ladokId)
          console.log(`==> Updated ${kthId} with Ladok ID ${ladokId}`)
        } else {
          console.log(`User ${kthId} has no Ladok ID in UG`)
        }
      }
      i++
      if (i === breakAfter) {
        console.log(`Has handled ${i} number of user. Stopping.`)
        return
      }
    } catch (e) {
      console.error(e)
      return
    }
  }
}

start()
