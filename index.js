'use strict';

var isSelfClosing = require('is-self-closing');
var extend = require('extend-shallow');
var define = require('define-property');
var util = require('snapdragon-util');
var Node = require('snapdragon-node');

/**
 * Parse the given `str` and return an AST.
 *
 * ```js
 * var snapdragon = new Snapdgragon([options]);
 * var ast = snapdragon.parse('foo/bar');
 * console.log(ast);
 * ```
 * @param {String} `str`
 * @param {Object} `options` Set `options.sourcemap` to true to enable source maps.
 * @return {Object} Returns an AST.
 * @api public
 */

module.exports = function(options) {
  return function(snapdragon) {
    snapdragon.define('parse', function(str, options) {
      return parse(str, extend({}, this.options, options));
    });
  };
};

function parse(str, options) {
  var opts = extend({normalizeWhitespace: false}, options);
  var $;

  if (typeof str === 'function' && str._root) {
    $ = str;
  } else if (typeof str !== 'string') {
    throw new TypeError('expected a string');
  } else {
    var cheerio = opts.cheerio || require('cheerio');
    $ = cheerio.load(str, opts);
  }

  if (typeof opts.omitEmpty === 'string' || Array.isArray(opts.omitEmpty)) {
    $(util.stringify(opts.omitEmpty)).each(function(i, node) {
      var text = $(node).text();
      if (!text.trim()) {
        $(node).remove();
      }
    });
  }

  if (opts.omit) {
    $(util.stringify(opts.omit)).remove();
  }

  // get the nodes to use for the snapdragon AST
  var nodes = $._root.children;

  // if `options.pick` is used, we essentially
  // convert the AST into a token stream, since pick does't
  // infer or guarantee any kind of tree-relationship
  if (opts.pick) {
    var arr = [];
    $(util.stringify(opts.pick)).each(function(i, ele) {
      arr.push(ele);
    });
    nodes = arr;
  }

  var ast = new Node({ type: 'string', nodes: nodes });
  var bos = new Node({ type: 'bos', val: ''});
  var eos = new Node({ type: 'eos', val: ''});

  define(bos, 'parent', ast);
  define(eos, 'parent', ast);
  nodes.unshift(bos);
  nodes.push(eos);

  var tokens = [];

  // visit over AST, calling "mapVisit" on each "node.nodes" along the way
  util.visit(ast, {recurse: true}, function(node, i) {
    // pre-process node, before "normalize" is called
    if (typeof opts.preprocess === 'function') {
      node = opts.preprocess($, node, ast, opts) || node;
    }

    node = normalize(node);

    // post-process node, after "normalize" is called
    if (typeof opts.postprocess === 'function') {
      node = opts.postprocess(node, ast, opts) || node;
    }

    // add the index of the token ("node.index" is used for the
    // position of the node in relationship to its siblings)
    define(node, 'i', tokens.length);
    tokens.push(node);
    return node;
  });

  // add non-enumerable tokens array to AST
  define(ast, 'tokens', tokens);

  // add a non-enumerable reference to cheerio to the AST
  define($, '$', ast);
  return ast;
}

/**
 * Normalize `node` to be a node that is more idiomatic to snapdragon.
 * We lose some of the cheerio methods, but we also gain snapdragon
 * features.
 *
 * @param {Object} `node`
 * @return {Object}
 */

function normalize(node) {
  if (node.type === 'directive') {
    node.name = node.name.replace(/^!/, '');
    node.type = 'tag';
  }

  // make some properties non-enumerable
  define(node, 'children', node.children);
  define(node, 'data', node.data);

  // rename to names supported by snapdragon
  renameProperty(node, 'children', 'nodes');
  renameProperty(node, 'data', 'val');

  // make cyclical references non-enumerable
  define(node, 'root', node.root);

  if (node.type === 'tag') {
    node.type = node.name;
    delete node.name;

    if (!isSelfClosing(node.type)) {
      util.wrapNodes(node, Node);
    }
  }

  if (!node.isNode) {
    node = new Node(node);
    // make cyclical references non-enumerable
    define(node, 'parent', node.parent);
    define(node, 'firstChild', node.firstChild);
    define(node, 'lastChild', node.lastChild);
    define(node, 'nodeType', node.nodeType);
  }
  return node;
}

function renameProperty(node, key, prop) {
  if (typeof node[key] !== 'undefined' && !node.hasOwnProperty(prop)) {
    node[prop] = node[key];
    define(node, key, node[key]);
  }
}

/**
 * Expose `.parse` method, so it can be used a non-plugin
 */

module.exports.parse = parse;
