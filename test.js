const test = require('ava')
const REPL = require('./index')

const commands = [{
		name: 'foo',
		impl: ({ session }) => session.set('foo', true)
	},
	{
		name: ['bar', 'b'],
		impl: ({ session }) => {
			let current = session.get('bar')
			if (current === undefined) current = 0
			session.set('bar', ++current)
		}
	}
]

test('repl', async t => {
	const repl = REPL.create(commands)
	t.is(repl.session.get('foo'), undefined)
	t.is(repl.session.get('bar'), undefined)

	await repl.exec('foo; bar; b;')
	t.is(repl.session.get('foo'), true)
	t.is(repl.session.get('bar'), 2)
})