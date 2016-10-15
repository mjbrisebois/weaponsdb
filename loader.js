var fs		= require('fs');
var Py		= require('pythonify');
var knexlib	= require('knex')
var Promise	= require('promise');

var knex	= knexlib({
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

var text	= fs.readFileSync('./detailed_firearms.json');
var data	= JSON.parse(text);

// var ammunitions	= waiter('ammunitions');
// ammunitions(key);
// ammunitions(key).waiting(callback);
// ammunitions(key).answer(value);
// ammunitions.register(key);
function waiter(name) {
    function repo_item() {
	if (!(this instanceof repo_item))
	    return new repo_item();
	this.waiters	= [];
	this.value	= undefined;
    }
    repo_item.prototype = {
	answer: function(v) {
	    this.value	= v;
	    this.waiters.forEach(function(f) {
		f(v);
	    });
	    return this;
	},
	waiting: function(f) {
	    var v	= this.value;
	    if (v === undefined)
		this.waiters.push(f);
	    else
		setTimeout(function() { f(v); }, 0);
	    return this;
	}
    };
    
    var dict		= {};
    function repo(k) {
	var k		= k.toLowerCase();
	if (dict[k] === undefined)
	    return false;
	else
	    return dict[k];
    }
    repo.register	= function(k) {
	var k		= k.toLowerCase();
	dict[k]		= repo_item();
	return dict[k];
    }
    return repo;
}

function error(e) {
    console.error(e);
    process.exit(0);
}

var UNKNOWN_CAT_ID	= 1;
var FIREARM_CAT_ID	= 2;

function loadLink(url) {
    return new Promise(function(f,r) {
	knex('links').where('url', url).then(function(rows) {
	    if (rows.length)
		f(rows[0].id);
	    else
		knex('links').insert({
		    "url": url
		}).then(function(ids) {
		    f(ids[0]);
		}, error);
	}, error);
    });
}

var categories	= waiter('categories');
function loadCategory(category, parentCategory) {
    // If subcat exists (by name) we use it's ID otherwise we need to
    // add subcat under the correct cat.  If cat doesn't exist we need
    // to add it.
    function query(c,id,f) {
	if (categories(c))
	    return categories(c).waiting(f);
	
	categories.register(c).waiting(f);
	
	knex('categories').insert({
	    "name": c,
	    "parent_id": id,
	}).then(function(ids) {
	    categories(c).answer(ids[0]);
	}, error);
    }
    
    return new Promise(function(f,r) {
	if (category) {
	    knex('categories')
		.where('name', category)
		.then(function(rows) {
		    // Sometimes the category already exists but it
		    // was made with an UNKNOWN parent.  If the one
		    // that is found is under UNKNOWN, and the one we
		    // have has a parent category, we must update the
		    // parent id of the existing one or insert a new.
		    var cat	= rows[0];
		    
		    if (cat && cat.parent_id !== UNKNOWN_CAT_ID)
			f(rows[0].id);
		    else if (parentCategory === FIREARM_CAT_ID)
			query(category, FIREARM_CAT_ID, f);
		    else if (parentCategory) {
			loadCategory(parentCategory, FIREARM_CAT_ID).then(function(id) {
			    if (cat) {
				knex('categories').update({
				    "parent_id": id
				}).where('id', rows[0].id).then(f, error);
			    }
			    else
				query(category, id, f);
			}, error);
		    }
		    else {
			query(category, UNKNOWN_CAT_ID, f);
		    }
		}, error);
	}
    });
}

var ammunitions	= waiter('ammunitions');
function loadAmmo(caliber) {
    return new Promise(function(f,r) {
	knex('ammunitions').where('caliber', caliber).then(function(rows) {
	    if (rows.length)
		f(rows[0].id);
	    else if (ammunitions(caliber)) {
		ammunitions(caliber).waiting(f);
	    }
	    else {
		ammunitions.register(caliber).waiting(f);

		knex('ammunitions').insert({
		    "caliber": caliber
		}).then(function(ids) {
		    ammunitions(caliber).answer(ids[0]);
		}, error);
	    }
	}, error);
    });
}

var regimes	= waiter('regimes');
function loadRegime(name) {
    return new Promise(function(f,r) {
	if (!name)
	    return f();
	knex('regimes').where('name', name).then(function(rows) {
	    if (rows.length)
		f(rows[0].id);
	    else if (regimes(name)) {
		regimes(name).waiting(f);
	    }
	    else {
		regimes.register(name).waiting(f);
		
		knex('regimes').insert({
		    "name": name
		}).then(function(ids) {
		    regimes(name).answer(ids[0]);
		}, error);
	    }
	}, error);
    });
}


function addManufacturerLink(id, url) {
    loadLink(url).then(function(linkId) {
	knex('manufacturer_has_link').insert({
	    "manufacturer_id": id,
	    "link_id": linkId,
	}).then(function(ids) {
	}, error);
    }, error);
}

var manufacturers	= waiter('manufacturers');
function loadManufacturer(m) {
    return new Promise(function(f,r) {
	knex('manufacturers').where("name", m.name).then(function(rows) {
	    if (rows.length)
		f(rows[0].id);
	    else if (manufacturers(m.name)) {
		manufacturers(m.name).waiting(f);
	    }
	    else {
		manufacturers.register(m.name);

		knex('manufacturers').insert({
		    "name": m.name,
		}).then(function(ids) {
		    var id	= ids[0];
		    manufacturers(m.name).answer(id);
		    
		    // set links
		    if (m.wikipedia_links) {
			m.wikipedia_links.forEach(function(url) {
			    addManufacturerLink(id, url);
			});
		    }
		    
		    f(id);
		}, error);
	    }
	    
	}, error);
    });
}

function addFirearmCategory(id, cat, subcat) {
    loadCategory(subcat, cat).then(function(catId) {
	knex('weapon_has_category').insert({
	    "weapon_id": id,
	    "category_id": catId,
	}).then(function(ids) {
	}, error);
    }, error);
}

function addFirearmLink(id, url) {
    loadLink(url).then(function(linkId) {
	knex('weapon_has_link').insert({
	    "weapon_id": id,
	    "link_id": linkId,
	}).then(function(ids) {
	}, error);
    }, error);
}

function addFirearmAmmo(id, caliber) {
    loadAmmo(caliber).then(function(ammoId) {
	knex('weapon_has_ammunition').insert({
	    "weapon_id": id,
	    "ammunition_id": ammoId,
	}).then(function(ids) {
	}, error);
    }, error);
}

function loadFirearm(fa, manufacturerId, parentId) {
    return new Promise(function(f,r) {
	loadRegime(fa.regime).then(function(regimeId) {
	    knex('weapons').insert({
		"name": fa.name,
		"created_in": regimeId,
		"manufactured_by": manufacturerId,
		"year": fa.yearStr,
		"description": fa.info,
		"variant_of": parentId,
	    }).then(function(ids) {
		var id	= ids[0];
		console.log("Added firearm", fa.name);
		
		// set categories
		if (fa.type) {
		    fa.type.forEach(function(subcategory) {
			addFirearmCategory(id, fa.category, subcategory);
		    });
		}

		// set ammunitions
		if (fa.ammunition) {
		    fa.ammunition.forEach(function(caliber) {
			addFirearmAmmo(id, caliber);
		    });
		}
		
		// set links
		if (fa.wikipedia_links) {
		    fa.wikipedia_links.forEach(function(url) {
			addFirearmLink(id, url);
		    });
		}

		// load variants
		if (fa.mods) {
		    fa.mods.forEach(function(f) {
			loadFirearm(f, manufacturerId, id);
		    });
		}
		
		f(id);
	    }, error);
	}, error);
    });
}

data.manufacturers.forEach(function(m) {
    // The best way to determine if the item is a manufacturer is the
    // firearms list.  If it is empty then it can't be a manufacturer.
    if (m.firearms && m.firearms.length) {
	// manufacturer
	loadManufacturer(m).then(function(id) {
	    console.log("Added manufacturer", m.name);
	    m.firearms.forEach(function(f) {
		loadFirearm(f, id);
	    });
	}, error);
    }
    else {
	// firearm
	loadFirearm(m);
    }
});
