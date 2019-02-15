require('dotenv').config()
const inquirer = require('inquirer')
const requiredEnvs = []

module.exports.getEnv = async function getEnv (key) {
  requiredEnvs.push(key)
  const value = process.env[key] || (await inquirer.prompt({
    name: 'value',
    message: `Provide a value for "${key}"`
  })).value

  return value
}
