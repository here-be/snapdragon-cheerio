var cheerio = require('../');
var Snapdragon = require('snapdragon');
var snapdragon = new Snapdragon();
snapdragon.use(cheerio());

var ast = snapdragon.parse('<strong>It worked!</strong>');
console.log(ast)
