'use strict';

require('mocha');
var util = require('util');
var assert = require('assert');
var parser = require('..');

describe('snapdragon-cheerio', function() {
  it('should export a function', function() {
    assert.equal(typeof parser, 'function');
  });

  it('should parse HTML and return a snapdragon AST', function() {
    var ast = parser.parse('<p>Foo</p>');
    assert.deepEqual(ast, {
      type: 'string',
      nodes: [
        {type: 'bos', val: ''},
        {type: 'p', attribs: {}, nodes: [
            {type: 'p.open', val: ''},
            {type: 'text', val: 'Foo'},
            {type: 'p.close', val: ''}
          ]
        },
        {type: 'eos', val: ''}
      ]
    });
  });

  it('should throw an error when invalid args are passed', function(cb) {
    try {
      parser.parse();
      cb(new Error('expected an error'));
    } catch (err) {
      assert(err);
      assert.equal(err.message, 'expected a string');
      cb();
    }
  });
});
