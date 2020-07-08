# @kessler/repl (wip)

a personal lib for building repls

## Install
```
npm i @kessler/repl
```

## usage

index.js

```js
const REPL  = require('@kessler/repl')

const commands = [
    { 
        name: ['foo', 'f'],
        impl: ({ cli, session, params }) => cli.print('hi')
    }
]

REPL.start(commands)
```

## scripts
```
node index script.cli
```

script.cli
```
foo;
foo;
foo;
```