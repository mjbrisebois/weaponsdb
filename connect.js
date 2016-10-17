var knexlib		= require('knex')
var knex		= knexlib({
    client: 'mysql',
    connection: {
	host: 'localhost',
	user: 'root',
	password: 'testing',
	database: 'weaponsdb'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');
module.exports		= knex;
