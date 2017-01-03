'use strict';

var detectIndent = require('detect-indent');
var stripAttr = require('strip-attributes');
var define = require('define-property');
var extend = require('extend-shallow');
var unescape = require('unescape');
var cheerio = require('cheerio');

module.exports = function(str, options) {
  var opts = extend({normalizeWhitespace: false}, options);
  var $ = cheerio.load(str, opts);

  if (opts.stripTags) {
    var tags = opts.stripTags;
    tags = Array.isArray(tags) ? tags : [tags];

    var len = tags.length;
    while (len--) {
      $(tags[len]).remove();
    }
  }

  var nodes = $._root.children;
  if (typeof opts.pick === 'string') {
    var res = $(opts.pick)[0];
    if (res && res.children) {
      nodes = res.children;
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

  visit(ast, function(node, i) {
    if (typeof opts.preprocess === 'function') {
      node = opts.preprocess(node, prev, $, ast) || node;
    }

    if (node.type === 'tag') {
      if (node.name === 'title') {
        node.val = $(node).text().trim();
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
        $('p', node).each(function(i, elem) {
          var str = $(this).html().trim();
          if (i > 0) str = ' ' + str;
          var span = $('<span></span>').html(str);
          $(this).replaceWith(span);
        });
      }

      if ((node.name === 'ul' || node.name === 'li')) {
        node.text = $(node).text();
        if (!node.text.trim()) {
          node.nodes = [];
          node.type = 'text';
          node.val = '';
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

    prev = node;
    return node;
  });

  prev = ast;
  visit(ast, function(node, i) {
    if (opts.literalPre && node.type === 'pre') return node;

    node = normalize(node, prev);

    if (node.type === 'link' && node.attribs && node.attribs.rel === 'canonical') {
      ast.canonical = node.attribs.href;
    }

    if (/:/.test(node.type)) {
      node.name = node.type;
      node.type = 'custom';
    }

    prev = node;
    return node;
  });

  prev = ast;
  visit(ast, function(node) {
    promoteTypes(node, ['span']);
    prev = node;
    return node;
  });

  if (options && options.readable) {
    prev = ast;
    visit(ast, function(node, i) {
      var undesiredElements = ['script', 'style', 'select', 'form', 'button', 'iframe', 'footer', 'nav', 'menu'];

      var unwantedAttribs = [
        'ad ',
        'ad-',
        'advert',
        'advertisement',
        'auth',
        'oauth',
        'button',
        'clear',
        'comment',
        'comments',
        'display:none',
        'foot',
        'footer',
        'hidden',
        'menu',
        'nav',
        'popup',
        'scroll',
        'share',
        'sidebar',
        'social',
        'transparent',
        'thread',
        'tags',
        'video-'
      ];

      if (isType(node, 'body') || isType(node.parent, 'body')) {
        prev = node;
        return node;
      }

      if (hasAttribs(node.parent, unwantedAttribs)) {
        // toNoop(node.parent);
        node.parent.nodes = [];
        node.parent.type = 'text';
        node.parent.val = '';

      } else if (isType(node.parent, undesiredElements)) {
        // toNoop(node.parent);
        node.parent.nodes = [];
        node.type = 'text';
        node.val = '';

      } else if (isType(node, undesiredElements)) {
        // toNoop(node);
        delete node.nodes;
        node.type = 'text';
        node.val = '';

      } else if (hasAttribs(node, unwantedAttribs)) {
        // toNoop(node);
        delete node.nodes;
        node.type = 'text';
        node.val = '';

      } else if (isType(node, 'div') && node.nodes.length === 2) {
        // toNoop(node);
        delete node.nodes;
        node.type = 'text';
        node.val = '';

      }

      prev = node;
      return node;
    });
  }

  prev = ast;
  if (typeof opts.process === 'function') {
    visit(ast, function(node, i) {
      opts.process(node, prev, $, ast);
      prev = node;
      return node;
    });
  }

  return ast;
};

function normalize(node, prev) {
  if (node.type === 'directive') {
    node.name = node.name.replace(/^!/, '');
    node.type = 'tag';
  }

  // make properties non-enumerable
  define(node, 'children', node.children);
  define(node, 'data', node.data);

  // rename to names supported by snapdragon
  rename(node, 'children', 'nodes');
  rename(node, 'data', 'val');

  // make cyclically redundant properties non-enumerable
  define(node, 'parent', node.parent || prev);
  define(node, 'root', node.root);
  define(node, 'prev', node.prev || prev);
  define(node, 'next', node.next);

  if (node.type === 'tag') {
    node.type = node.name;
    delete node.name;
    wrapNodes(node);
  }
  return node;
}

function toNoop(node, type) {
  define(node, 'children', node.children);
  define(node, 'name', node.name);
  define(node, 'data', node.data);
  if (node.attribs) node.attribs = {};
  if (node.nodes) node.nodes = [];
  if (type) node.type = type;
  node.val = '';
}

function decorate(node, old, prev) {
  define(node, 'parent', old.parent || prev);
  define(node, 'prev', old.prev);
  define(node, 'next', old.next);
  return node;
}

function isType(node, type) {
  if (!Array.isArray(type)) {
    return node.type === type;
  }
  for (var i = 0; i < type.length; i++) {
    if (isType(node, type[i])) {
      return true;
    }
  }
  return false;
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

function hasAttribs(node, val, prop) {
  if (Array.isArray(val)) {
    for (var i = 0; i < val.length; i++) {
      if (hasAttribs(node, val[i], prop)) {
        return true;
      }
    }
    return false;
  }

  if (!node.attribs && !node.nodes) return false;
  if (prop) {
    var str = node.attribs[prop].toLowerCase();
    if (val instanceof RegExp && val.test(str)) {
      return true;
    }
    if (str === val) {
      return true;
    }
    return false;
  }

  if (node.attribs) {
    for (var key in node.attribs) {
      if (node.attribs.hasOwnProperty(key)) {
        var str = node.attribs[key].toLowerCase();
        if (val instanceof RegExp && val.test(str)) {
          return true;
        }
        if (str === val) {
          return true;
        }
      }
    }
  }
  return false;
}

function rename(node, key, prop) {
  if (typeof node[key] !== 'undefined') {
    node[prop] = node[key];
  }
}

function selfClosing(node) {
  var tags = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  return tags.indexOf(node.type) !== -1;
}

/**
 * Visit `node` with the given `fn`
 */

function wrapNodes(node) {
  if (!node.nodes || selfClosing(node)) return;
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
  return nodes ? mapVisit(nodes, fn) : node;
}

/**
 * Map visit over array of `nodes`.
 */

function mapVisit(nodes, fn) {
  if (!Array.isArray(nodes)) {
    return nodes;
  }
  for (var i = 0; i < nodes.length; i++) {
    visit(nodes[i], fn, i);
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


