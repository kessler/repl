const { Input } = require('enquirer')
const { isString } = require('util')
const tokenize = require('@kessler/tokenize')
const parseArguments = require('@kessler/parse-arguments')
const fs = require('fs').promises
const prettyjson = require('prettyjson')

class REPL {
	constructor(commands = []) {
		this._session = new Session()
		this._commands = {}
		this._prompt = undefined
		this._history = []
		this._historyPosition = 0

		this.register({
			name: 'exit',
			impl: () => process.exit()
		})

		commands.forEach(command => this.register(command))
	}

	/**
	 *    make the repl "run", this function calls itself in the end
	 *    
	 */
	async run() {
		const promptSpec = {
			validate: (value, state, item, index) => this._validateCommand(input, value, state, item, index),
			name: 'command',
			message: `cli${await this._getPromptContextMessage()}`,
			up: (input, key) => this._onUpKeyPress(this.prompt, input, key),
			down: (input, key) => this._onDownKeyPress(this.prompt, input, key)
		}

		const input = this._newPrompt(promptSpec)

		const userInput = await input.run()
		if (userInput === '') return this.run()

		await this.exec(userInput)
		await input.close()

		this._history.push(userInput)
		this._historyPosition = this._history.length
		return this.run()
	}

	/**
	 *    execute a script made of commands that are registered in this repl
	 *    separated by ;
	 *    @param  {String} script
	 *
	 */
	async exec(script) {
		const commands = script.trim().split(';').filter(command => command && command.length > 0)

		for (let commandAndParams of commands) {

			const [commandName, ...params] = parseUserInput(commandAndParams)
			// should i skip empty commands (like when the script has ;;)
			//if (commandName === '') continue
			const commandEntry = this._commands[commandName]
			if (!commandEntry) {
				throw new Error(`unknown or missing command in "${script}"`)
			}

			try {
				const result = await commandEntry.command({
					params: parseArguments(params),
					cli: this,
					session: this._session
				})
			} catch (e) {
				this.danger(e)
			}
		}
	}

	/**
	 *    register a command that can be executed in this cli
	 *    
	 *    @param  {String|String[]} options.name - the name or array of names that invokes the command
	 *    @param  {Function} options.impl - command implementation
	 *
	 */
	register({
		name,
		impl
	}) {
		if (isString(name)) {
			name = [name]
		}

		name.forEach(commandName => this._commands[commandName] = { command: impl })
	}

	print(...params) {
		if (this.prompt) {
			console.log(this.prompt.styles.primary(...params))
		} else {
			console.log(...params)
		}
	}

	printObject(object) {
		console.log(prettyjson.render(object))
	}

	success(...params) {
		if (this.prompt) {
			console.log(this.prompt.styles.success(...params))
		} else {
			console.log(...params)
		}
	}

	error(...params) {
		return this.danger(...params)
	}

	danger(...params) {
		if (this.prompt) {
			console.log(this.prompt.styles.danger(...params))
		} else {
			console.log(...params)
		}
	}

	warning(...params) {
		if (this.prompt) {
			console.log(this.prompt.styles.warning(...params))
		} else {
			console.log(...params)
		}
	}

	dark(...params) {
		if (this.prompt) {
			console.log(this.prompt.styles.dark(...params))
		} else {
			console.log(...params)
		}
	}

	get prompt() {
		return this._prompt
	}

	get commands() {
		return Object.freeze(this._commands)
	}

	get session() {
		return this._session
	}

	_newPrompt(spec, clazz = Input) {
		if (!spec.cancel) {
			spec.cancel = async () => this._onCancel()
		}

		this._prompt = new clazz(spec)

		return this._prompt
	}

	async _onCancel() {
		await this.prompt.close()
		return this.run()
	}

	_validateCommand(prompt, value, state, item, index) {
		if (state.name === 'command') {
			if (value === '') return true
			const commands = value.split(';')

			for (let commandAndParams of commands) {
				const [commandName, ...params] = parseUserInput(commandAndParams)
				if (this._commands[commandName] === undefined) {
					return prompt.styles.danger(`unknown command "${commandName}"`)
				}
			}
		}

		return true
	}

	_onUpKeyPress(prompt, input, key) {
		if (this._history.length === 0) return
		if (this._historyPosition === -1) {
			this._historyPosition = this._history.length
		}

		prompt.input = this._history[--this._historyPosition] || ''
		prompt.render()
	}

	_onDownKeyPress(prompt, input, key) {
		if (this._history.length === 0) return
		if (this._historyPosition === this._history.length) {
			this._historyPosition = -1
		}

		prompt.input = this._history[++this._historyPosition] || ''
		prompt.render()
	}

	async _getPromptContextMessage() {
		return ''
	}

	async _onTargetChanged(target) {
		if (target.type() === 'page') {
			this._sessionState.currentPage = await target.page()
			this.dark(`\ntarget changed ${target.url()}`)
		}
	}

	static create(commands) {
		return new REPL(commands)
	}

	static async start(commands) {
		const script = process.argv[process.argv.length - 1]

		const cli = REPL.create(commands)

		if (process.argv.length > 2 && !script.startsWith('--')) {
			await cli.exec(await fs.readFile(script, 'utf8'))
		}

		cli.run()
		return cli
	}
}

function parseUserInput(input) {
	const tokens = tokenize(input)
	return tokens.filter(token => token.content !== '"').map(token => token.content.trim())
}

class Session {
	constructor() {
		this._sessionData = new Map()
	}

	set(name, value) {
		this._sessionData.set(name, value)
	}

	get(name) {
		return this._sessionData.get(name)
	}

	status() {
		return Array.from(this._sessionData.keys()).join('\n')
	}
}

module.exports = REPL