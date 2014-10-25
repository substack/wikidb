# wikidb

database for offline-first distributed wikis

# example

## create

First, we'll have a script to create documents:

```
var wikidb = require('wikidb');
var db = require('level')('/tmp/wiki.db');
var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: { t: [ 'tag', 'tags' ] }
});

var wdb = wikidb(db, { dir: '/tmp/wiki.blob' });
var opts = {
    key: argv._[0],
    prev: argv.prev,
    tag: argv.tag
};
var w = wdb.createWriteStream(opts, function (err, key) {
    console.log(key);
});
process.stdin.pipe(w);
```

Now we create the first document:

```
$ echo hello there | node create.js 'welcome page' --tag=welcome
2e0c45ea142f59b52d616bcf17837ff4aa07d985ec2b55d13b42c4104a67f0a2
```

and next we can make an updated version of the 'welcome page' by referring to
its hash in a new document:

```
$ echo 'greetings, stranger!' | node create.js 'welcome page' \
  --prev=2e0c45ea142f59b52d616bcf17837ff4aa07d985ec2b55d13b42c4104a67f0a2 \
  --tag=welcome --tag=greeting
e208b25dde1e33f70ab0cb047ed5ce2e87fca1e782c5598bc2ebc7465ce478d2
```

## recent

This script uses `.recent()` to pull down the recent changes:

``` js
var wikidb = require('wikidb');
var db = require('level')('/tmp/wiki.db');
var wdb = wikidb(db, { dir: '/tmp/wiki.blob' });
var through = require('through2');

wdb.recent().pipe(through.obj(function (row, enc, next) {
    console.log('key:  ' + row.meta.key);
    console.log('hash: ' + row.hash);
    console.log('date: ' + new Date(row.meta.time));
    console.log('-----------------------------');
    var r = wdb.createReadStream(row.hash);
    r.pipe(process.stdout);
    r.on('end', function () { console.log(); next() });
}));
```

Running the script shows the recent changes:

```
$ node recent.js 
key:  welcome page
hash: 2e0c45ea142f59b52d616bcf17837ff4aa07d985ec2b55d13b42c4104a67f0a2
date: Fri Oct 24 2014 10:04:07 GMT+0100 (BST)
-----------------------------
hello there

key:  welcome page
hash: e208b25dde1e33f70ab0cb047ed5ce2e87fca1e782c5598bc2ebc7465ce478d2
date: Fri Oct 24 2014 10:04:19 GMT+0100 (BST)
-----------------------------
greetings, stranger!

```
