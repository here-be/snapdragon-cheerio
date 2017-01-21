# snapdragon-cheerio [![NPM version](https://img.shields.io/npm/v/snapdragon-cheerio.svg?style=flat)](https://www.npmjs.com/package/snapdragon-cheerio) [![NPM monthly downloads](https://img.shields.io/npm/dm/snapdragon-cheerio.svg?style=flat)](https://npmjs.org/package/snapdragon-cheerio)  [![NPM total downloads](https://img.shields.io/npm/dt/snapdragon-cheerio.svg?style=flat)](https://npmjs.org/package/snapdragon-cheerio) [![Linux Build Status](https://img.shields.io/travis/jonschlinkert/snapdragon-cheerio.svg?style=flat&label=Travis)](https://travis-ci.org/jonschlinkert/snapdragon-cheerio)

> Snapdragon plugin for converting a cheerio AST to a snapdragon AST.

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save snapdragon-cheerio
```

## Usage

Use the `.parse` method directly to return an AST:

```js
var snapdragonCheerio = require('snapdragon-cheerio');
var ast = snapdragonCheerio.parse('<strong>It worked!</strong>');
console.log(ast);
// Node {
//   type: 'string',
//   nodes:
//    [ Node { type: 'bos', val: '', index: 0 },
//      Node { type: 'strong', attribs: {}, index: 1, nodes: [Object] },
//      Node { type: 'eos', val: '', index: 2 } ] }
```

**Snapdragon plugin usage**

Pass to [snapdragon](https://github.com/jonschlinkert/snapdragon)'s `.use` method to use as a plugin:

```js
var snapdragonCheerio = require('snapdragon-cheerio');
var Snapdragon = require('snapdragon');
var snapdragon = new Snapdragon();
snapdragon.use(snapdragonCheerio());

var ast = snapdragon.parse('<strong>It worked!</strong>');
// Node {
//   type: 'string',
//   nodes:
//    [ Node { type: 'bos', val: '', index: 0 },
//      Node { type: 'strong', attribs: {}, index: 1, nodes: [Object] },
//      Node { type: 'eos', val: '', index: 2 } ] }
```

Visit [snapdragon](https://github.com/jonschlinkert/snapdragon) to learn how to compile the generated AST into a string.

## About

### Related projects

* [cheerio](https://www.npmjs.com/package/cheerio): Tiny, fast, and elegant implementation of core jQuery designed specifically for the server | [homepage](https://github.com/cheeriojs/cheerio#readme "Tiny, fast, and elegant implementation of core jQuery designed specifically for the server")
* [snapdragon-capture-set](https://www.npmjs.com/package/snapdragon-capture-set): Plugin that adds a `.captureSet()` method to snapdragon, for matching and capturing substrings that have… [more](https://github.com/jonschlinkert/snapdragon-capture-set) | [homepage](https://github.com/jonschlinkert/snapdragon-capture-set "Plugin that adds a `.captureSet()` method to snapdragon, for matching and capturing substrings that have an `open` and `close`, like braces, brackets, etc")
* [snapdragon-capture](https://www.npmjs.com/package/snapdragon-capture): Snapdragon plugin that adds a capture method to the parser instance. | [homepage](https://github.com/jonschlinkert/snapdragon-capture "Snapdragon plugin that adds a capture method to the parser instance.")
* [snapdragon-node](https://www.npmjs.com/package/snapdragon-node): Snapdragon utility for creating a new AST node in custom code, such as plugins. | [homepage](https://github.com/jonschlinkert/snapdragon-node "Snapdragon utility for creating a new AST node in custom code, such as plugins.")
* [snapdragon-util](https://www.npmjs.com/package/snapdragon-util): Utilities for the snapdragon parser/compiler. | [homepage](https://github.com/jonschlinkert/snapdragon-util "Utilities for the snapdragon parser/compiler.")
* [snapdragon](https://www.npmjs.com/package/snapdragon): Fast, pluggable and easy-to-use parser-renderer factory. | [homepage](https://github.com/jonschlinkert/snapdragon "Fast, pluggable and easy-to-use parser-renderer factory.")

### Contributing

Pull requests and stars are always welcome. For bugs and feature requests, [please create an issue](../../issues/new).

Please read the [contributing guide](.github/contributing.md) for advice on opening issues, pull requests, and coding standards.

### Building docs

_(This document was generated by [verb-generate-readme](https://github.com/verbose/verb-generate-readme) (a [verb](https://github.com/verbose/verb) generator), please don't edit the readme directly. Any changes to the readme must be made in [.verb.md](.verb.md).)_

To generate the readme and API documentation with [verb](https://github.com/verbose/verb):

```sh
$ npm install -g verb verb-generate-readme && verb
```

### Running tests

Install dev dependencies:

```sh
$ npm install -d && npm test
```

### Author

**Jon Schlinkert**

* [github/jonschlinkert](https://github.com/jonschlinkert)
* [twitter/jonschlinkert](https://twitter.com/jonschlinkert)

### License

Copyright © 2017, [Jon Schlinkert](https://github.com/jonschlinkert).
Released under the [MIT license](LICENSE).

***

_This file was generated by [verb-generate-readme](https://github.com/verbose/verb-generate-readme), v0.4.1, on January 21, 2017._