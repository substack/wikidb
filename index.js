var ForkDB = require('forkdb');
var inherits = require('inherits');
var through = require('through2');
var inherits = require('inherits');

module.exports = WikiDB;
inherits(WikiDB, ForkDB);

function WikiDB (db, opts) {
    if (!(this instanceof WikiDB)) return new WikiDB(db, opts);
    if (!opts) opts = {};
    ForkDB.call(this, db, opts);
}

WikiDB.prototype.createWriteStream = function (key, cb) {
    var opts = {
        prebatch: function (rows, wkey) {
            rows.push({
                type: 'put',
                key: [ 'wiki', Date.now(), key ],
                value: wkey
            });
            return rows;
        }
    };
    var meta = {
        key: key,
        time: Date.now()
    };
    return ForkDB.prototype.createWriteStream.call(this, meta, opts, fn);
    
    function fn (err, key) {
        if (err && cb) cb(err)
        else if (cb) cb(key)
    }
};

WikiDB.prototype.recent = function (key, cb) {
    var self = this;
    var opts = {
        gt: [ 'wiki', null ],
        lt: [ 'wiki', undefined ]
    };
    var s = self.db.createReadStream(opts);
    var tr = through.obj(function (row, enc, next) {
        self.getMeta(row.value, function (err, meta) {
            tr.push({ hash: row.value, meta: meta });
            next();
        });
    });
    s.on('error', function (err) { tr.emit('error', err) });
    if (cb) tr.on('error', cb);
    return s.pipe(tr);
};
