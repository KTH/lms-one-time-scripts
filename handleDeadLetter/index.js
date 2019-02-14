require('dotenv').config()
const promisify = require('util').promisify
const azure = require('azure-sb')
const chalk = require('chalk')
const inquirer = require('inquirer')
const ora = require('ora')

const service = azure.createServiceBusService(process.env.AZURE_SERVICEBUS_CONNECTION_STRING)
const TOPIC_PATH = 'lms-topic-carlos'
const SUBSCRIPTION_PATH = 'lms-carlos-hello-world'

const getSubscription = () => promisify(service.getSubscription.bind(service))(TOPIC_PATH, SUBSCRIPTION_PATH)
const unlockMessage = promisify(service.unlockMessage.bind(service))
const deleteMessage = promisify(service.deleteMessage.bind(service))
async function getDLQMessage () {
  const receiveMessage = promisify(service.receiveSubscriptionMessage.bind(service))
  return receiveMessage(TOPIC_PATH, SUBSCRIPTION_PATH + '/$DeadLetterQueue', { isPeekLock: true })
}


async function start () {
  let run = true
  let messages = 0

  do {
    const sp1 = ora('Connecting to the Dead Letter Queue...').start()
    try {
      const response = await getSubscription()
      sp1.stop()
      messages = response.CountDetails['d3p1:DeadLetterMessageCount']
      console.log(chalk`Messages in dead letter queue: {bold ${messages}}`)
    } catch (err) {
      sp1.fail('Failure when connecting to the subscription')
      throw err
    }

    if (messages <= 0) {
      break
    }

    const sp2 = ora('Getting the first message in DLQ').start()
    let message
    try {
      message = await getDLQMessage()
    } catch (err) {
      sp2.fail('Failure when getting message from the DLQ')
      throw err
    }

    sp2.stop()

    console.log()
    console.log(message)
    console.log()

    const {nextStep} = await inquirer.prompt([{
      name: 'nextStep',
      message: 'What do you want to do with that message?',
      type: 'list',
      choices: [
        {name: 'Delete (consume) the message', value: 'delete'},
        {name: 'Don\'t do anything. Exit the app', value: 'exit'}
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
