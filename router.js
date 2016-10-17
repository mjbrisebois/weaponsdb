var logger		= require('bunyan').createLogger;
var ChaosRouter		= require('chaosrouter');
var Py			= require('pythonify');
var restruct		= require('restruct-data');
var knex		= require('./connect.js');

var log			= logger({
    name: "Router",
    level: 'trace'
});

var tableInfo		= {};
knex('information_schema.columns')
    .columns('table_schema', 'table_name', 'column_name')
    .where('table_schema', 'weaponsdb')
    .orderBy('table_name', 'ordinal_position').then(function(rows) {
	for (var i in rows) {
	    var row		= rows[i];
	    var table		= row['table_name'];
	    var column		= row['column_name'];
	    Py(tableInfo)
		.setdefault(table, [])
		.push(column);
	}
	// log.info(tableInfo);
	router.ready();
    });

function getColumns(table, rename) {
    var table		= table.split(' ')[0].replace(/[^A-Za-z0-9_-]/g, '');
    var columns		= Py(tableInfo).get(table, []).slice();
    for (var i in columns) {
	if (typeof rename === 'string') {
	    if (rename.indexOf('*') === -1)
		columns[i]	= [rename+'.'+columns[i], rename+"_"+columns[i] ];
	    else
		columns[i]	= [rename+'.'+columns[i], rename.replace('*', columns[i])];
	}
	else
	    columns[i]	= [table+'.'+columns[i], table+'_'+columns[i]];
    }
    return columns;
}

var router		= ChaosRouter("routes.json", {
    defaultExec: function (args, resp) {
	var knex	= this.args.db;
	var trx		= this.args.knex;

	var table	= this.directives['table'];
	var where	= this.directives['where'];
	var joins	= this.directives['joins'] || [];
	var groupby	= this.directives['group_by'];
	var struct	= this.directives['structure'];

	if (table === undefined || struct === undefined)
	    return resp({
		error: 404,
		message: "Dead end! API endpoint does not exist. ("+this.path+")"
	    });
	
	var columns	= getColumns(table);
	
	var q		= trx(table);
	
	for (var i=0; i<joins.length; i++) {
    	    var join	= joins[i];
	    if (typeof join === 'string')
    		q.leftJoin(knex.raw(join));
	    else {
    		var t	= join[0]; // table name including alias
    		var c	= join[1]; // the two joining columns
    		var r	= join[2]; // rename string
		Py(columns).extend(getColumns(t, r))
		if (typeof c === 'string')
    		    q.join( knex.raw(t+" "+(r||'')+" on "+c) );
		else
    		    q.leftJoin( knex.raw(t+" "+(r||'')), c[0], c[1] );
	    }
	}

	for (var i in columns) {
    	    if (Array.isArray(columns[i]))
    		columns[i]	= columns[i].join(' as ');
    	    q.column(columns[i]);
	}
	
	if (where)
    	    q.where( knex.raw(fill(where, this.args)) );
	if (groupby)
    	    q.groupBy(groupby);

	// log.trace("Query: \n"+q.toString());

	q.then(function(result) {
	    var result	= struct === undefined
		? result
		: restruct(result, struct);
	    resp(result);
	}, function(err) {
	    resp({
		"error": err.name,
		"message": err.message
	    });
	}).catch(function(err) {
	    resp({
		"error": err.name,
		"message": err.message
	    });
	});
    }
});
// router.directive('response', function (response, next, resp) {
// });

module.exports	= router;
