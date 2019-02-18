const { getEnv } = require('../lib/envs')
const promisify = require('util').promisify
const azure = require('azure-sb')
const chalk = require('chalk')
const inquirer = require('inquirer')
const ora = require('ora')

async function getDLQMessage (service, topic, subscription) {
  const receiveMessage = promisify(service.receiveSubscriptionMessage.bind(service))
  return receiveMessage(topic, subscription + '/$DeadLetterQueue', { isPeekLock: true })
}

async function start () {
  const service = azure.createServiceBusService(await getEnv('AZURE_SERVICEBUS_CONNECTION_STRING'))

  const TOPIC_PATH = await getEnv('AZURE_SERVICEBUS_TOPIC_NAME')
  const SUBSCRIPTION_PATH = await getEnv('AZURE_SERVICEBUS_SUBSCRIPTION_NAME')

  const getSubscription = () => promisify(service.getSubscription.bind(service))(TOPIC_PATH, SUBSCRIPTION_PATH)
  const unlockMessage = promisify(service.unlockMessage.bind(service))
  const deleteMessage = promisify(service.deleteMessage.bind(service))

  let run = true
  let messages = 0

  do {
    const sp1 = ora('Connecting to the Dead Letter Queue...').start()
    try {
      const response = await getSubscription()
      sp1.stop()
      console.log(chalk`Messages in normal queue:      {bold ${response.CountDetails['d3p1:ActiveMessageCount']}}`)
      messages = response.CountDetails['d3p1:DeadLetterMessageCount']
      console.log(chalk`Messages in dead letter queue: {bold ${messages}}`)
    } catch (err) {
      sp1.fail('Failure when connecting to the subscription')
      console.error(err)
      return
    }

    if (messages <= 0) {
      break
    }

    const sp2 = ora('Getting the first message in DLQ').start()
    let message
    try {
      message = await getDLQMessage(service, TOPIC_PATH, SUBSCRIPTION_PATH)
    } catch (err) {
      sp2.fail('Failure when getting message from the DLQ')
      throw err
    }

    sp2.stop()

    console.log()
    console.log(message)
    console.log()

    const { nextStep } = await inquirer.prompt([{
      name: 'nextStep',
      message: 'What do you want to do with that message?',
      type: 'list',
      choices: [
        { name: 'Delete (consume) the message', value: 'delete' },
        { name: 'Don\'t do anything. Exit the app', value: 'exit' }
      ]
    }])

    if (nextStep === 'delete') {
      const sp3 = ora('Deleting message...').start()
      try {
        await deleteMessage(message)
      } catch (err) {
        sp3.fail('Failure deleting message')
        throw err
      }
      sp3.succeed('Message deleted')
    } else {
      const sp3 = ora('Releasing message...').start()
      try {
        await unlockMessage(message)
      } catch (err) {
        sp3.fail('Failure while unlocking the message')
      }
      sp3.stop()
      run = false
    }
  } while (run)
}

start()
