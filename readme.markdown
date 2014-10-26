# wikidb

database for offline-first distributed wikis

[![build status](https://secure.travis-ci.org/substack/wikidb.png)](http://travis-ci.org/substack/wikidb)

# example

## create

First, we'll have a script to create documents:

``` js
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

# methods

``` js
var wikidb = require('wikidb')
```

## var wdb = wikidb(db, opts)

Create a new wikidb instance `wdb` from a leveldb handle `db`.

Optionally, provide:

`opts.dir` - location to store file blobs

## var w = wdb.createWriteStream(meta, opts={}, cb)

Create a writable stream `w` that will populate content at `meta.key` and link
back to previous documents using an array of hashes in `meta.prev`.

Optionally provide an `opts.prebatch(rows, key, fn)` function that will be
called before `rows` are inserted with `db.batch()`. `fn(err, rows)` should
provide the new rows to insert.

Optionally tag a document by setting `opts.tags` to an array of string tags.

`cb(err, hash)` fires with an error or the hash of the content written into `w`.

## var r = wdb.byTag(opts, cb)

Return a readable object stream `r` that searches for objects by `opts.tag`.
The objects in the stream have `key` and `hash` properties.

If `opts` is a string, `opts` will be used as the `opts.tag`. 

If provided, `cb(err, results)` fires with an error or the array of `results`
objects.

## var r = wdb.search(terms, opts={})

Search for `terms`, an array of strings which must all be present in a full text
scan of each head document.

The result stream has the same properties as `wdb.head()`: `'key'` and `'hash'`
properties on each object.

## var r = wdb.recent(opts={}, cb)

List documents with a readable object stream `r` ordered by date, most recent to
least recent. Each object output by `r` has a `hash` and `key` property.

# forkdb methods

The methods in this section are inherited from forkdb and accept the same
arguments.

## var d = wdb.replicate(opts={}, cb)

Replicate with the duplex stream `d`.

Set `opts.mode` to `'sync'` (default)`, `'push'`, or `'pull'` to use different
replication strategies.

## var r = wdb.createReadStream(hash)

Return a readable stream `r` with the content for `hash`.

## var r = wdb.heads(key, opts={}, cb)

Return the heads for `key` as a readable object stream that outputs objects with
`hash` properties.

## var r = wdb.keys(opts={}, cb)

Return a readable object stream with a `key` property for each available key.

## var r = wdb.tails(key, opts={}, cb)

Return a readable object stream `r` for all the tails of `key`.

## var r = wdb.list(opts={}, cb)

Return all the documents in the database as an object stream that outputs
objects with `key` and `hash` properties.

## var r = wdb.links(hash, opts={}, cb)

Return a readable object stream `r` that outputs all the documents that link to
`hash` as objects with `key` and `hash` properties.

## wdb.get(hash, cb)

Fetch the metadata for `hash` as `cb(err, meta)`.

## var r = wdb.history(hash, opts={}, cb)

Fetch all the history for `hash` as a readable object stream `r` until a branch
in the history when a `'branch'` event fires with a new readable object stream
for each fork.

## wdb.future(hash, opts={}, cb)

Fetch all the future for `hash` as a readable object stream `r` until a branch
in the future when a `'branch'` event fires with a new readable object stream
for each fork.

# install

With [npm](https://npmjs.org), do:

```
npm install wikidb
```

# license

MIT
