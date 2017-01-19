'use strict';

var voidElements = require('void-elements');
var detectIndent = require('detect-indent');
var stripAttr = require('strip-attributes');
var define = require('define-property');
var extend = require('extend-shallow');
var unescape = require('unescape');

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
      var opts = extend({}, this.options, options);
      return convert(str, opts);
    });
  };
};

function convert(str, options) {
  var opts = extend({normalizeWhitespace: false}, options);
  var cheerio = opts.cheerio || require('cheerio');
  var $;

  if (typeof str === 'function' && str._root) {
    $ = str;
  } else if (typeof str !== 'string') {
    throw new TypeError('expected a string');
  } else {
    $ = cheerio.load(str, opts);
  }

  if (typeof opts.omitEmpty === 'string' || Array.isArray(opts.omitEmpty)) {
    $(stringify(opts.omitEmpty)).each(function(i, node) {
      var re = /^(?:t(?:[rhd]|able|body|foot)|code|pre|br|hr)$/;
      if (re.test(node.name)) return;

      var text = $(node).text();
      if (!text.trim()) {
        $(node).remove();
      }
    });
  }

  // `.stripTags` will be deprecated
  var omit = opts.stripTags || opts.omit;
  if (omit) {
    $(stringify(omit)).remove();
  }

  var nodes = $._root.children;
  if (opts.pick) {
    var arr = [];
    $(stringify(opts.pick)).each(function(i, ele) {
      arr.push(ele);
    });

    if (arr.length) {
      nodes = arr;
    }
  }

  var ast = { type: 'string', nodes: nodes };
  var bos = { type: 'bos', val: ''};
  var eos = { type: 'eos', val: ''};

  define(bos, 'parent', ast);
  define(eos, 'parent', ast);

  nodes.unshift(bos);
  nodes.push(eos);
  var prev = ast;
  var tokens = [];

  visit(ast, function(node, i) {
    if (typeof opts.preprocess === 'function') {
      node = opts.preprocess(node, prev, $, ast, opts) || node;
    }

    if (node.type === 'tag') {
      if (node.name === 'title') {
        node.val = node.data = $(node).text().trim();
      }

      if (node.name === 'code') {
        node.html = unescape($(node).html());
      }

      if ((node.name === 'table' || node.name === 'dl')) {
        node.html = stripAttr($.html(node));
        var indent = detectIndent(node.html).indent;
        var last = node.html.split('\n').pop();
        if (last.slice(0, indent.length) === indent) {
          node.html = node.html.replace(new RegExp('^' + indent, 'gm'), '');
        }
      }

      if (node.name === 'li') {
        $('p', node).each(function(i, ele) {
          var str = $(this).html().trim();
          if (i > 0) str = ' ' + str;
          var span = $('<span></span>').html(str);
          $(this).replaceWith(span);
        });
      }

      if ((node.name === 'ul' || node.name === 'ol' || node.name === 'li')) {
        node.text = $(node).text();
        if (!node.text.trim()) {
          toNoop(node, true);
        }
      }

      if (node.name === 'pre') {
        node.outer = stripAttr($.html(node));
        var html = $(node).html();

        if (html) {
          var code = $('code', node) || {};
          var codeInner = opts.literalPre === true
            ? code.html && code.html()
            : code.text && code.text();

          var text = codeInner || $(node).text();

          node.gfm = true;
          node.text = '\n' + text.trim() + '\n';
          node.html = '\n' + (code ? text : html).trim() + '\n';
          node.attr = (code.attr && code.attr());
        } else {
          var tok = { type: 'text', val: html };
          node.nodes = [tok];
          define(tok, 'parent', node);
          wrapNodes(node);
        }
      } else if (node.name === 'code') {
        node.html = $(node).html();
        node.text = $(node).text();
      }
    }

    tokens.push(node);
    prev = node;
    return node;
  });

  visit(ast, function(node, i) {
    if (opts.literalPre && node.type === 'pre') return node;

    node = normalize(node, prev);
    if (/:/.test(node.type)) {
      node.name = node.type;
      node.type = 'custom';
    }

    if (node.type === 'link' && node.attribs && node.attribs.rel === 'canonical') {
      ast.canonical = node.attribs.href;
    }

    prev = node;
    return node;
  });

  visit(ast, function(node) {
    promoteTypes(node, ['span']);
    return node;
  });

  if (typeof opts.process === 'function') {
    prev = ast;
    visit(ast, function(node, i) {
      opts.process(node, prev, $, ast);
      prev = node;
      return node;
    });
  }

  return ast;
}

function normalize(node, prev, options) {
  if (node.type === 'directive') {
    node.name = node.name.replace(/^!/, '');
    node.type = 'tag';
  }

  // make properties non-enumerable
  define(node, 'children', node.children);
  define(node, 'data', node.data);

  // rename to names supported by snapdragon
  renameProperty(node, 'children', 'nodes');
  renameProperty(node, 'data', 'val');

  // make cyclically redundant properties non-enumerable
  define(node, 'parent', node.parent);
  define(node, 'root', node.root);
  define(node, 'prev', node.prev);
  define(node, 'next', node.next);

  if (node.type === 'tag') {
    node.type = node.name;
    delete node.name;
    wrapNodes(node);
  }

  return node;
}

function renameProperty(node, key, prop) {
  if (typeof node[key] !== 'undefined' && !node[prop]) {
    node[prop] = node[key];
  }
}

function hasType(node, type) {
  if (!node.nodes) return;
  for (var i = 0; i < node.nodes.length; i++) {
    if (node.nodes[i].type === type) {
      return true;
    }
  }
  return false;
}

function isSelfClosing(node) {
  return voidElements.hasOwnProperty(node.type);
}

/**
 * Visit `node` with the given `fn`
 */

function wrapNodes(node) {
  if (!node.nodes || isSelfClosing(node)) return;
  var open = { type: node.type + '.open', val: ''};
  var close = { type: node.type + '.close', val: ''};

  define(open, 'parent', node);
  define(open, 'next', node.nodes[0]);
  define(open, 'prev', null);

  define(close, 'parent', node);
  define(close, 'next', null);
  define(close, 'prev', node.nodes[node.nodes.length - 1]);

  node.nodes.unshift(open);
  node.nodes.push(close);
}

/**
 * Visit `node` with the given `fn`
 */

function visit(node, fn, idx) {
  node = fn(node, idx);
  var nodes = node.nodes || node.children;
  if (nodes) {
    mapVisit(node, nodes, fn);
  }
  return node;
}

/**
 * Map visit over array of `nodes`.
 */

function mapVisit(node, nodes, fn) {
  if (Array.isArray(nodes)) {
    for (var i = 0; i < nodes.length; i++) {
      define(nodes[i], 'parent', node);
      nodes[i] = visit(nodes[i], fn, i) || nodes[i];
    }
  }
  return nodes;
}

function promoteTypes(node, types) {
  for (var i = 0; i < types.length; i++) {
    promoteNodes(node, types[i]);
  }
}

function promoteNodes(node, type) {
  if (node.type === type) {
    promote(node.parent, type);
  }
  while (hasType(node, type)) {
    promote(node, type);
  }
}

function promote(node, type) {
  if (!node.nodes) return;
  for (var i = 0; i < node.nodes.length; i++) {

    var tok = node.nodes[i];
    if (!tok) continue;
    var nodes = [];

    if (tok.type === type) {
      for (var j = 0; j < tok.nodes.length; j++) {
        var child = tok.nodes[j];
        if (/\.(open|close)/.test(child.type)) continue;
        if (child.attribs && !node.attribs) {
          node.attribs = child.attribs;
        }
        define(child, 'parent', node);
        nodes.push(child);
      }
      node.nodes.splice(i, 1, ...nodes);
    }
  }
}

function arrayify(val) {
  return val ? (Array.isArray(val) ? val : [val]) : [];
}

function stringify(val) {
  return arrayify(val).join(',');
}

function toNoop(node, nodes) {
  if (nodes) {
    node.nodes = [];
  } else {
    delete node.nodes;
  }

  node.type = 'text';
  node.val = '';
}

/**
 * Expose `.convert` method, so it can be used a non-plugin
 */

module.exports.convert = convert;
