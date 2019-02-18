# One Time Scripts

Scripts made for being used not frequently. Maybe one time only.

## CLI programs

All scripts in this project are run from a CLI. Hence, it's safe to call them "CLI programs" rather than "scripts". When you write your own program, try to think on the UX, even considering that the "GUI" is the command line.

## All environmental variables should be optional

To avoid all kinds of configuration, it's better to have the environmental variables as optional. The library `lib/envs.js` has a very useful function `getEnv()`. You just pass the name of the env variable and if it's present will return it; otherwise will prompt the user to give a value.

```js
// This is the usage:
const someVariable = await getEnv('AZURE_SERVICEBUS_QUEUE')

// You can use it anywhere (inside an async function)
const canvasApi = new CanvasApi(await getEnv('CANVAS_API_URL'), await getEnv('CANVAS_API_KEY'))
```

## Directions

- Single `node_modules` directory located in the root of the repository
- Single `.env` file in the root of the directory
- Single `lib` directory in the root for shared functionality across scripts.

## Frequently Used Modules

- dotenv. To read the environmental variables
- inquirer. To prompt questions to the user.
- chalk. To format the console
- ora. To display (and hide) a spinner
- kth-canvas-api. To connect to Canvas
- request and request-promise. To make API calls
