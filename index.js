const inquirer = require('inquirer')

;(async function start () {
  console.log(
    'Welcome to the One Time Scripts'
  )
  const { answer } = await inquirer.prompt({
    name: 'answer',
    message: 'Choose the thing that you want to do today',
    type: 'list',
    choices: [
      { name: 'Handle dead letters of a queue', value: './handleDeadLetter' },
      { name: 'Get a list of users from UG', value: './getUgUsers' },
      { name: 'Check names in Canvas', value: './checkNamesInCanvas' }
    ]
  })
  require(answer)
})()
